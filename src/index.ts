import { loadConfig } from "./config.js";
import { fetchFilteredIssues } from "./github/issues.js";
import { filterIssuesWithLLM } from "./llm/issueFilter.js";
import { runOrchestrator } from "./loop/orchestrator.js";
import { Logger } from "./logger/logger.js";
import { generateReport } from "./logger/report.js";

async function main() {
  const config = loadConfig();
  const logger = new Logger(config.logsDir);

  console.log(`[Dark Factory] Target repo: ${config.targetRepo}`);
  logger.log("run_started", { targetRepo: config.targetRepo, maxIssues: config.maxIssuesPerRun });

  console.log(`[Dark Factory] Fetching open issues...`);
  const issues = await fetchFilteredIssues(config);

  if (issues.length === 0) {
    console.log("[Dark Factory] No matching issues found.");
    await logger.flush();
    return;
  }

  console.log(`[Dark Factory] Found ${issues.length} issue(s) after basic filters`);
  logger.log("issues_fetched", { total: issues.length });

  const suitableIssues = await filterIssuesWithLLM(config, issues);

  if (suitableIssues.length === 0) {
    console.log("[Dark Factory] No suitable issues found after LLM filter.");
    await logger.flush();
    return;
  }

  console.log(`[Dark Factory] ${suitableIssues.length} issue(s) passed LLM filter:`);
  for (const issue of suitableIssues) {
    const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
    console.log(`  #${issue.number}${labels} — ${issue.title}`);
  }

  const results = await runOrchestrator(config, suitableIssues, logger);

  logger.log("run_completed", {
    total: results.length,
    prCreated: results.filter((r) => r.status === "pr_created").length,
    abandoned: results.filter((r) => r.status === "abandoned").length,
    errored: results.filter((r) => r.status === "errored").length,
  });

  await logger.flush();

  const reportPath = await generateReport(config.logsDir, logger.getLogPath(), results, logger.getEvents());

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[Dark Factory] Run complete — ${results.length} issue(s) processed`);
  for (const r of results) {
    if (r.status === "pr_created") {
      console.log(`  ✓ #${r.issue.number} — PR created: ${r.prUrl}`);
    } else if (r.status === "abandoned") {
      console.log(`  ✗ #${r.issue.number} — Abandoned after ${r.retries} retries`);
    } else {
      console.log(`  ! #${r.issue.number} — Error: ${r.error}`);
    }
  }
  console.log(`\n[Dark Factory] Report: ${reportPath}`);
  console.log(`[Dark Factory] Log:    ${logger.getLogPath()}`);
}

main().catch((err) => {
  console.error("[Dark Factory] Fatal error:", err.message);
  process.exit(1);
});
