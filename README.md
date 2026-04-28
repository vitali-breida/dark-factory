# Dark Factory

An autonomous system that fetches open GitHub issues, generates fixes using Claude AI, runs the repository's test suite, and opens pull requests — with minimal human involvement.

## How It Works

1. **Issue Tracking** — fetches open, unassigned issues from a target GitHub repository
2. **Automated Fixing** — clones the repo and uses Claude claude-sonnet-4-6 to generate a fix
3. **Verification** — runs the repository's own test suite against the fix
4. **Pull Request** — pushes the fix as a branch and opens a PR with results
5. **Reporting** — produces a structured log and a Markdown summary of every run

## Requirements

- Node.js 20+
- A GitHub personal access token with `repo` scope
- An Anthropic API key

## Setup

```bash
git clone https://github.com/your-org/dark-factory
cd dark-factory
npm install
cp .env.example .env
```

Edit `.env` and fill in your credentials (see [Configuration](#configuration)).

## Configuration

**Credentials**

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | GitHub personal access token (`repo` scope) |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key |

**Target repository**

| Variable | Default | Description |
|---|---|---|
| `TARGET_REPO` | — | Repository to fix issues in, e.g. `owner/repo` |
| `TARGET_BRANCH` | `main` | Base branch to clone and open PRs against |
| `LABEL_FILTER` | *(all)* | Comma-separated labels to filter by, e.g. `bug,help wanted` |

**Run limits**

| Variable | Default | Description |
|---|---|---|
| `MAX_ISSUES_PER_RUN` | `5` | Max number of issues to attempt per run |
| `WORKSPACES_DIR` | `./workspaces` | Directory for temporary repo clones |

**LLM models**

| Variable | Default | Description |
|---|---|---|
| `FILTER_MODEL` | `claude-haiku-4-5-20251001` | Model used for issue triage (cheap, fast) |
| `FIX_MODEL` | `claude-sonnet-4-6` | Model used for fix generation |

**LLM context limits**

| Variable | Default | Description |
|---|---|---|
| `MAX_RELEVANT_FILES` | `10` | Max files passed to the fix prompt |
| `MAX_INPUT_TOKENS` | `150000` | Abort if estimated input exceeds this |
| `MAX_FILE_LINES` | `300` | Lines read per file before truncation |

> **Note:** `GITHUB_TOKEN` must have the `repo` scope to access private repositories and create pull requests.

## Usage

```bash
npm start
```

## Human Steps Required

The system runs end-to-end autonomously after initial setup. The only manual steps are:

1. Create a `GITHUB_TOKEN` with `repo` scope at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Create an `ANTHROPIC_API_KEY` at [console.anthropic.com](https://console.anthropic.com)
3. Set `TEST_COMMAND` to whatever the target repo uses to run tests (check its README)
4. Review and merge (or close) the generated pull requests — the system never auto-merges

## Tech Stack

| Package | Purpose |
|---|---|
| `@anthropic-ai/sdk` | Claude API with prompt caching |
| `@octokit/rest` | GitHub API — issues, branches, pull requests |
| `simple-git` | Git operations — clone, branch, commit, push |
| `dotenv` | Load `.env` into `process.env` |
| `tsx` | Run TypeScript directly without a build step |
