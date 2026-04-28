import * as fs from "fs/promises";
import * as path from "path";
import { LogEvent } from "./logger.js";
import { IssueResult } from "../loop/orchestrator.js";

export async function generateReport(
  logsDir: string,
  logPath: string,
  results: IssueResult[],
  events: LogEvent[]
): Promise<string> {
  const runStarted = events.find((e) => e.event === "run_started");
  const timestamp = runStarted?.timestamp ?? new Date().toISOString();

  const prCreated = results.filter((r) => r.status === "pr_created").length;
  const abandoned = results.filter((r) => r.status === "abandoned").length;
  const errored = results.filter((r) => r.status === "errored").length;

  const rows = results
    .map((r) => {
      const status =
        r.status === "pr_created" ? "✓ PR Created" :
        r.status === "abandoned" ? "✗ Abandoned" : "! Error";
      const pr = r.prUrl ? `[#${r.prNumber}](${r.prUrl})` : "—";
      const title = r.issue.title.slice(0, 50);
      return `| #${r.issue.number} | ${title} | ${status} | ${r.retries} | ${pr} |`;
    })
    .join("\n");

  const errorSection = results
    .filter((r) => r.status === "errored" && r.error)
    .map((r) => `- Issue #${r.issue.number}: ${r.error}`)
    .join("\n");

  const report = `# Dark Factory Run — ${timestamp}

## Summary
- Issues processed: ${results.length}
- PRs created: ${prCreated}
- Abandoned (max retries reached): ${abandoned}
- Errors: ${errored}

## Results

| Issue | Title | Status | Retries | PR |
|-------|-------|--------|---------|-----|
${rows}
${errorSection ? `\n## Errors\n${errorSection}\n` : ""}
---
_Log file: ${path.basename(logPath)}_
`;

  const reportPath = logPath.replace(".jsonl", ".md");
  await fs.mkdir(logsDir, { recursive: true });
  await fs.writeFile(reportPath, report, "utf-8");

  return reportPath;
}
