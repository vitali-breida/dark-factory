import { loadConfig } from "./config.js";
import { fetchFilteredIssues } from "./github/issues.js";

async function main() {
  const config = loadConfig();
  console.log(`[Dark Factory] Target repo: ${config.targetRepo}`);
  console.log(`[Dark Factory] Fetching open issues...`);

  const issues = await fetchFilteredIssues(config);

  if (issues.length === 0) {
    console.log("[Dark Factory] No matching issues found.");
    return;
  }

  console.log(`\n[Dark Factory] Found ${issues.length} issue(s):\n`);
  for (const issue of issues) {
    const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
    console.log(`  #${issue.number}${labels} — ${issue.title}`);
    console.log(`    ${issue.url}`);
    console.log(`    Created: ${issue.createdAt}`);
    console.log();
  }
}

main().catch((err) => {
  console.error("[Dark Factory] Fatal error:", err.message);
  process.exit(1);
});
