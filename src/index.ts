import { loadConfig } from "./config.js";
import { fetchFilteredIssues } from "./github/issues.js";
import { WorkspaceManager } from "./git/workspace.js";

async function main() {
  const config = loadConfig();
  console.log(`[Dark Factory] Target repo: ${config.targetRepo}`);
  console.log(`[Dark Factory] Fetching open issues...`);

  const issues = await fetchFilteredIssues(config);

  if (issues.length === 0) {
    console.log("[Dark Factory] No matching issues found.");
    return;
  }

  console.log(`[Dark Factory] Found ${issues.length} issue(s):`);
  for (const issue of issues) {
    const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
    console.log(`  #${issue.number}${labels} — ${issue.title}`);
  }

  const issue = issues[0];
  console.log(`\n[Dark Factory] Cloning repo for issue #${issue.number}...`);

  const workspace = await WorkspaceManager.cloneRepo(config, issue);

  const fileTree = await workspace.listFiles();
  console.log(`\n[workspace] File tree:\n`);
  console.log(fileTree);

  await workspace.cleanup();
  console.log("\n[Dark Factory] Done.");
}

main().catch((err) => {
  console.error("[Dark Factory] Fatal error:", err.message);
  process.exit(1);
});
