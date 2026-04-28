import { loadConfig } from "./config.js";
import { fetchFilteredIssues } from "./github/issues.js";
import { filterIssuesWithLLM } from "./llm/issueFilter.js";
import { runOrchestrator } from "./loop/orchestrator.js";

async function main() {
  const config = loadConfig();
  console.log(`[Dark Factory] Target repo: ${config.targetRepo}`);
  console.log(`[Dark Factory] Fetching open issues...`);

  const issues = await fetchFilteredIssues(config);

  if (issues.length === 0) {
    console.log("[Dark Factory] No matching issues found.");
    return;
  }

  console.log(`[Dark Factory] Found ${issues.length} issue(s) after basic filters`);

  const suitableIssues = await filterIssuesWithLLM(config, issues);

  if (suitableIssues.length === 0) {
    console.log("[Dark Factory] No suitable issues found after LLM filter.");
    return;
  }

  console.log(`[Dark Factory] ${suitableIssues.length} issue(s) passed LLM filter:`);
  for (const issue of suitableIssues) {
    const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
    console.log(`  #${issue.number}${labels} — ${issue.title}`);
  }

  const results = await runOrchestrator(config, suitableIssues);

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
}

main().catch((err) => {
  console.error("[Dark Factory] Fatal error:", err.message);
  process.exit(1);
});
