# Dark Factory — Design Write-up

## Overview

Dark Factory is a prototype autonomous system that fetches open GitHub issues, generates code fixes using Claude AI, verifies them locally by running the repository's own test suite, and opens pull requests — with no human involvement between start and PR creation.

---

## Design Decisions

### Iterative LLM pipeline

Rather than sending everything to the LLM in a single prompt, the system uses two sequential calls per issue:

1. **File selector (Haiku)** — given the issue body and the full file tree, Claude picks which files (≤10) are likely relevant. This keeps the second prompt focused and avoids filling the context window with unrelated code.
2. **Fix generator (Sonnet)** — given only the relevant files and the issue body, Claude generates a structured `{ reasoning, changes[] }` response with full file contents to write to disk.

Using a cheaper, faster model (Haiku) for triage and a more capable model (Sonnet) for code generation balances cost and quality.

### Prompt caching

The repo file tree and file contents are sent as cached blocks (`cache_control: { type: "ephemeral" }`). On retry calls — when the first fix fails tests and Claude is asked to revise — these blocks are read from Anthropic's cache rather than re-processed, saving ~80% of input token cost on each retry.

### Local verification before publishing

The system runs the repository's test suite locally inside a temporary workspace before pushing anything to GitHub. Only a fix that passes tests locally gets turned into a PR. This avoids polluting the target repository with broken branches.

### Isolated workspaces

Each issue gets its own shallow-cloned directory (`workspaces/<repo>-<issue>-<timestamp>/`). Shallow cloning (`--depth 1`) avoids downloading the full git history, which can be gigabytes on large repositories. The workspace is deleted after the PR is created or the issue is abandoned.

### Full file replacement instead of diffs

The LLM returns complete file contents rather than unified diffs. Diffs require precise line numbers and context that the LLM often gets wrong. Full file replacement is simpler to apply and validate — a wrong diff silently corrupts a file, while a wrong full replacement is immediately visible.

### Structured JSON output

The LLM is instructed to respond with a JSON object containing `reasoning` and `changes[]`. The parser extracts the first `{`…`}` block from the response, tolerating markdown code fences or prose before the JSON. This is more robust than asking for a specific format and failing on any deviation.

---

## Limitations

**No understanding of the full codebase.** The file selector picks at most 10 files and each is truncated at 300 lines. For issues that require understanding relationships between many files, or that touch large files, the fix may be incomplete or incorrect.

**Test suite dependency.** If the target repository has no tests, or if `TEST_COMMAND` is misconfigured, the system cannot verify fixes and will either fail or produce unverified PRs. The quality of verification is directly proportional to the quality of the existing test suite.

**No awareness of remote CI.** After a PR is opened, Dark Factory does not monitor GitHub Actions or any other CI system. If remote CI fails for environment-specific reasons (secrets, external services, OS differences), the system will not react.

**Single-file fixes only in practice.** While the system supports multi-file changes, the LLM tends to focus on one or two files. Issues requiring coordinated changes across many files are unlikely to be fixed correctly.

**No deduplication across runs.** If the same issue is still open after a previous run created a PR, the system will attempt it again on the next run and open a duplicate PR.

**Sequential processing.** Issues are processed one at a time. A run over 5 issues can take 20–40 minutes depending on test suite duration and LLM response times.

---

## Potential Improvements

**Remote CI awareness.** After PR creation, listen for `check_run.completed` webhooks from GitHub. If CI fails, automatically trigger a retry cycle and update the PR with a new commit.

**Issue scoring and prioritization.** Before attempting fixes, rank issues by estimated difficulty (e.g. number of files likely involved, issue length, label) and attempt easiest ones first to maximize PR success rate per run.

**Parallel processing.** Process multiple issues concurrently using a bounded concurrency pool (`p-limit`). Bottleneck is LLM response time (~30–60s per fix), so parallelism would significantly reduce total run time.

**Unified diff output.** Ask the LLM to produce unified diffs instead of full file contents. This reduces output tokens significantly on large files and makes LLM errors more visible during review.

**Persistent state.** Track which issues have already been attempted in a local SQLite database. Avoid re-attempting issues that already have open PRs, and record which fixes were merged vs. closed to build a feedback signal.

**Self-hosted test execution.** Run tests inside a Docker container matching the target repo's environment. This eliminates "works locally, fails in CI" failures caused by OS differences, missing system dependencies, or environment variables.

**Comment on the issue.** After creating a PR, post a comment on the original GitHub issue linking to the PR and summarising what was changed. This closes the loop for issue reporters.
