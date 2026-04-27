import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export interface Config {
  githubToken: string;
  targetRepo: string;
  targetBranch: string;
  maxIssuesPerRun: number;
  labelFilter: string[];
  workspacesDir: string;
}

export function loadConfig(): Config {
  const labelRaw = optionalEnv("LABEL_FILTER", "");
  return {
    githubToken: requireEnv("GITHUB_TOKEN"),
    targetRepo: requireEnv("TARGET_REPO"),
    targetBranch: optionalEnv("TARGET_BRANCH", "main"),
    maxIssuesPerRun: parseInt(optionalEnv("MAX_ISSUES_PER_RUN", "5"), 10),
    labelFilter: labelRaw ? labelRaw.split(",").map((s) => s.trim()) : [],
    workspacesDir: optionalEnv("WORKSPACES_DIR", "./workspaces"),
  };
}
