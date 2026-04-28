import { Config } from "../config.js";
import { GitHubIssue } from "./issues.js";
import { getOctokit } from "./client.js";
import { LLMFixResponse } from "../llm/fixer.js";
import { TestResult } from "../runner/testRunner.js";

export interface PullRequest {
  url: string;
  number: number;
}

export async function createPullRequest(
  config: Config,
  issue: GitHubIssue,
  branchName: string,
  fix: LLMFixResponse,
  testResult: TestResult,
  retries: number
): Promise<PullRequest> {
  const octokit = getOctokit(config);
  const [owner, repo] = config.targetRepo.split("/");

  const changedFiles = fix.changes.map((c) => `- \`${c.path}\``).join("\n");
  const testStatus = testResult.passed ? "✅ PASSED" : "⚠️ FAILED (pushed after max retries)";

  const body = `## Automated Fix for Issue #${issue.number}

> ${issue.title}

This pull request was generated automatically by **Dark Factory**.

### What was changed
${fix.reasoning}

### Modified files
${changedFiles}

### Verification
- Test command: \`${config.testCommand}\`
- Test result: ${testStatus}
- Duration: ${(testResult.durationMs / 1000).toFixed(1)}s
- Retries needed: ${retries}

---
_This PR was created autonomously. Please review carefully before merging._`;

  const pr = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
    owner,
    repo,
    title: `[Dark Factory] fix: ${issue.title}`.slice(0, 120),
    body,
    head: branchName,
    base: config.targetBranch,
  });

  return { url: pr.data.html_url, number: pr.data.number };
}
