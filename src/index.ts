import { loadConfig } from "./config.js";
import { fetchFilteredIssues } from "./github/issues.js";
import { WorkspaceManager } from "./git/workspace.js";
import { generateFix } from "./llm/fixer.js";
import { filterIssuesWithLLM } from "./llm/issueFilter.js";
import { runTests } from "./runner/testRunner.js";

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

  const issue = suitableIssues[0];
  console.log(`\n[Dark Factory] Processing issue #${issue.number}: ${issue.title}`);

  const workspace = await WorkspaceManager.cloneRepo(config, issue);

  try {
    const repoTree = await workspace.listFiles();
    console.log(`[workspace] ${repoTree.split("\n").length} files in repo`);

    console.log(`[llm] Analyzing issue and generating fix...`);
    const fix = await generateFix(config, issue, repoTree, workspace.getDir());

    console.log(`\n[llm] Reasoning: ${fix.reasoning}`);
    console.log(`\n[llm] Applying ${fix.changes.length} change(s):`);

    await workspace.applyFileChanges(fix.changes);

    console.log(`\n[runner] Setup: ${config.setupCommand}`);
    await runTests(workspace.getDir(), config.setupCommand, config.testTimeoutMs);

    console.log(`[runner] Test command: ${config.testCommand}`);
    const result = await runTests(workspace.getDir(), config.testCommand, config.testTimeoutMs);

    const status = result.passed ? "PASS" : "FAIL";
    console.log(`[runner] ${status} — exit code ${result.exitCode}, duration: ${(result.durationMs / 1000).toFixed(1)}s`);

    if (!result.passed) {
      console.log(`\n[runner] Test output${result.truncated ? " (truncated)" : ""}:\n`);
      console.log(result.output);
    }
  } finally {
    await workspace.cleanup();
  }

  console.log("\n[Dark Factory] Done.");
}

main().catch((err) => {
  console.error("[Dark Factory] Fatal error:", err.message);
  process.exit(1);
});
