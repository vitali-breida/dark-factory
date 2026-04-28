import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  return parseInt(optionalEnv(key, String(fallback)), 10);
}

export interface Config {
  // Credentials
  githubToken: string;
  anthropicApiKey: string;

  // Target repository
  targetRepo: string;
  targetBranch: string;
  labelFilter: string[];

  // Run limits
  maxIssuesPerRun: number;
  workspacesDir: string;

  // LLM models
  filterModel: string;
  fixModel: string;

  // LLM context limits
  maxRelevantFiles: number;
  maxInputTokens: number;
  maxFileLines: number;
}

export function loadConfig(): Config {
  const labelRaw = optionalEnv("LABEL_FILTER", "");
  return {
    // Credentials
    githubToken: requireEnv("GITHUB_TOKEN"),
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),

    // Target repository
    targetRepo: requireEnv("TARGET_REPO"),
    targetBranch: optionalEnv("TARGET_BRANCH", "main"),
    labelFilter: labelRaw ? labelRaw.split(",").map((s) => s.trim()) : [],

    // Run limits
    maxIssuesPerRun: optionalInt("MAX_ISSUES_PER_RUN", 5),
    workspacesDir: optionalEnv("WORKSPACES_DIR", "./workspaces"),

    // LLM models
    filterModel: optionalEnv("FILTER_MODEL", "claude-haiku-4-5-20251001"),
    fixModel: optionalEnv("FIX_MODEL", "claude-sonnet-4-6"),

    // LLM context limits
    maxRelevantFiles: optionalInt("MAX_RELEVANT_FILES", 10),
    maxInputTokens: optionalInt("MAX_INPUT_TOKENS", 150_000),
    maxFileLines: optionalInt("MAX_FILE_LINES", 300),
  };
}
