import { loadConfig } from "./config.js";
import { fetchFilteredIssues } from "./github/issues.js";
import { WorkspaceManager } from "./git/workspace.js";
import { generateFix } from "./llm/fixer.js";
import { filterIssuesWithLLM } from "./llm/issueFilter.js";

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
    console.log(`\n[llm] Generated ${fix.changes.length} change(s):`);
    for (const change of fix.changes) {
      console.log(`  ${change.action.padEnd(6)}  ${change.path}`);
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
