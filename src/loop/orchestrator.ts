import { Config } from "../config.js";
import { GitHubIssue } from "../github/issues.js";
import { WorkspaceManager } from "../git/workspace.js";
import { generateFix, generateRetryFix } from "../llm/fixer.js";
import { runTests, TestResult } from "../runner/testRunner.js";
import { createPullRequest } from "../github/pr.js";
import { Logger } from "../logger/logger.js";

export type IssueStatus = "pr_created" | "abandoned" | "errored";

export interface IssueResult {
  issue: GitHubIssue;
  status: IssueStatus;
  prUrl?: string;
  prNumber?: number;
  retries: number;
  testResult?: TestResult;
  error?: string;
}

async function processIssue(config: Config, issue: GitHubIssue, logger: Logger): Promise<IssueResult> {
  const branchName = `dark-factory/fix-issue-${issue.number}-${Date.now()}`;
  let retries = 0;
  let workspace: WorkspaceManager | null = null;

  try {
    logger.log("issue_started", { title: issue.title, url: issue.url }, issue.number);

    workspace = await WorkspaceManager.cloneRepo(config, issue);
    const repoTree = await workspace.listFiles();
    console.log(`[workspace] ${repoTree.split("\n").length} files in repo`);
    logger.log("workspace_cloned", { path: workspace.getDir() }, issue.number);

    console.log(`[llm] Analyzing issue and generating fix...`);
    let fix = await generateFix(config, issue, repoTree, workspace.getDir());
    logger.log("fix_generated", { changedFiles: fix.changes.map((c) => c.path) }, issue.number);

    console.log(`\n[llm] Reasoning: ${fix.reasoning}`);
    console.log(`[llm] Applying ${fix.changes.length} change(s):`);
    await workspace.applyFileChanges(fix.changes);
    logger.log("fix_applied", { files: fix.changes.map((c) => c.path) }, issue.number);

    console.log(`\n[runner] Setup: ${config.setupCommand}`);
    await runTests(workspace.getDir(), config.setupCommand, config.testTimeoutMs);

    let testResult = await runTests(workspace.getDir(), config.testCommand, config.testTimeoutMs);
    console.log(`[runner] ${testResult.passed ? "PASS" : "FAIL"} — exit code ${testResult.exitCode}, duration: ${(testResult.durationMs / 1000).toFixed(1)}s`);
    logger.log(testResult.passed ? "tests_passed" : "tests_failed", { exitCode: testResult.exitCode, durationMs: testResult.durationMs }, issue.number);

    while (!testResult.passed && retries < config.maxRetries) {
      retries++;
      console.log(`\n[orchestrator] Tests failed — retry ${retries}/${config.maxRetries}`);
      logger.log("retry_attempted", { attempt: retries }, issue.number);

      await workspace.resetChanges();
      fix = await generateRetryFix(config, issue, repoTree, workspace.getDir(), testResult.output);

      console.log(`[llm] Retry reasoning: ${fix.reasoning}`);
      console.log(`[llm] Applying ${fix.changes.length} change(s):`);
      await workspace.applyFileChanges(fix.changes);

      testResult = await runTests(workspace.getDir(), config.testCommand, config.testTimeoutMs);
      console.log(`[runner] ${testResult.passed ? "PASS" : "FAIL"} — exit code ${testResult.exitCode}, duration: ${(testResult.durationMs / 1000).toFixed(1)}s`);
      logger.log(testResult.passed ? "tests_passed" : "tests_failed", { exitCode: testResult.exitCode, durationMs: testResult.durationMs, retry: retries }, issue.number);
    }

    if (!testResult.passed && retries >= config.maxRetries) {
      console.log(`[orchestrator] Abandoned issue #${issue.number} after ${retries} retries`);
      logger.log("fix_abandoned", { retries }, issue.number);
      return { issue, status: "abandoned", retries, testResult };
    }

    await workspace.createBranch(branchName);
    const commitMsg = `fix: resolve issue #${issue.number} — ${issue.title.slice(0, 60)}\n\nAutomated fix by Dark Factory.\nIssue: ${issue.url}`;
    await workspace.commitAndPush(commitMsg);

    const pr = await createPullRequest(config, issue, branchName, fix, testResult, retries);
    console.log(`[orchestrator] PR created: ${pr.url}`);
    logger.log("pr_created", { prUrl: pr.url, prNumber: pr.number, retries }, issue.number);

    return { issue, status: "pr_created", prUrl: pr.url, prNumber: pr.number, retries, testResult };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[orchestrator] Error on issue #${issue.number}: ${error}`);
    logger.log("issue_errored", { error }, issue.number);
    return { issue, status: "errored", retries, error };
  } finally {
    await workspace?.cleanup();
  }
}

export async function runOrchestrator(config: Config, issues: GitHubIssue[], logger: Logger): Promise<IssueResult[]> {
  const results: IssueResult[] = [];

  for (const issue of issues) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[orchestrator] Processing issue #${issue.number}: ${issue.title}`);
    const result = await processIssue(config, issue, logger);
    results.push(result);
  }

  return results;
}
