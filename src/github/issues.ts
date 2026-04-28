import { Config } from "../config.js";
import { getOctokit } from "./client.js";

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
  createdAt: string;
}

export async function fetchFilteredIssues(config: Config): Promise<GitHubIssue[]> {
  const octokit = getOctokit(config);
  const [owner, repo] = config.targetRepo.split("/");

  const resp = await octokit.request("GET /repos/{owner}/{repo}/issues", {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  const issues = resp.data;
  console.log(`[issues] GitHub returned ${issues.length} open issue(s)`);

  const filtered = issues
    .filter((issue) => {
      if (issue.pull_request) { console.log(`[issues] #${issue.number} skipped: is a pull request`); return false; }
      if (issue.assignee) { console.log(`[issues] #${issue.number} skipped: already assigned`); return false; }
      if (!issue.body || issue.body.trim().length < 20) { console.log(`[issues] #${issue.number} skipped: body too short or missing`); return false; }
      if (config.labelFilter.length > 0) {
        const issueLabels = issue.labels.map((l) =>
          typeof l === "string" ? l : l.name ?? ""
        );
        const hasLabel = config.labelFilter.some((f) => issueLabels.includes(f));
        if (!hasLabel) { console.log(`[issues] #${issue.number} skipped: no matching label`); return false; }
      }
      return true;
    })
    .slice(0, config.maxIssuesPerRun)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      url: issue.html_url,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
      createdAt: issue.created_at,
    }));

  return filtered;
}
