import { GitHubIssue } from "../github/issues.js";

export interface RelevantFile {
  path: string;
  content: string;
}

export function buildFileSelectorPrompt(issue: GitHubIssue, repoTree: string): string {
  return `You are an expert software engineer. Given a GitHub issue and a repository file tree, identify which files are most likely relevant to fixing the issue.

REPOSITORY FILE TREE:
${repoTree}

ISSUE #${issue.number}: ${issue.title}
${issue.body}

Return ONLY a JSON array of file paths (strings), no explanation. Maximum 10 files. Example:
["src/foo.ts", "src/bar.ts"]`;
}

export function buildFileContentsBlock(files: RelevantFile[]): string {
  return files
    .map((f) => `// FILE: ${f.path}\n${f.content}`)
    .join("\n\n---\n\n");
}

export function buildFixPrompt(issue: GitHubIssue): string {
  return `ISSUE TO FIX #${issue.number}: ${issue.title}

${issue.body}

Based on the repository file tree and file contents provided above, generate a fix for this issue.

Respond with ONLY a JSON object in this exact format, no explanation outside the JSON:
{
  "reasoning": "brief explanation of what was wrong and what you changed",
  "changes": [
    { "path": "src/foo.ts", "content": "full new file content here", "action": "modify" }
  ]
}

Action must be one of: "create", "modify", "delete".
For "delete" actions, set content to an empty string.
Always provide the COMPLETE file content, not just the changed lines.`;
}

export function buildRetryPrompt(issue: GitHubIssue, testOutput: string): string {
  return `ISSUE TO FIX #${issue.number}: ${issue.title}

${issue.body}

Your previous fix was applied but the test suite FAILED. Here is the test output:

\`\`\`
${testOutput}
\`\`\`

Based on the repository file tree and file contents provided above, generate a revised fix that addresses both the original issue and the test failures.

Respond with ONLY a JSON object in this exact format:
{
  "reasoning": "brief explanation of what was wrong with the previous fix and what you changed",
  "changes": [
    { "path": "src/foo.ts", "content": "full new file content here", "action": "modify" }
  ]
}`;
}
