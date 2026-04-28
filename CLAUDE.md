# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # run the system (tsx, no build step needed)
npm run build      # compile to dist/ via tsc
```

No test suite exists yet. Type-check with `npx tsc --noEmit`.

## Architecture

The system runs as a single sequential process driven by `src/index.ts`:

```
index.ts
  → config.ts                   load + validate .env
  → github/issues.ts            fetch open unassigned issues via GitHub REST API
  → llm/issueFilter.ts          LLM triage: keep only clearly-described bugs (Haiku)
  → per issue:
      git/workspace.ts          shallow-clone repo into workspaces/<repo>-<n>-<ts>/
      llm/fixer.ts              two LLM calls: file selector → fix generator (Sonnet)
      [future] runner/          run test suite, retry on failure
      [future] github/pr.ts     push branch + open PR
      git/workspace.ts          cleanup temp dir
```

### Key design decisions

**Two LLM calls per issue** (`src/llm/fixer.ts`):
1. File selector — asks Claude which files (≤10) are relevant; uses `config.filterModel`
2. Fix generator — sends file contents + issue body, returns `{ reasoning, changes[] }`; uses `config.fixModel`

Both calls use prompt caching (`cache_control: { type: "ephemeral" }`) on the repo tree and file contents blocks. The beta header `anthropic-beta: prompt-caching-2024-07-31` is set in `src/llm/client.ts`. TypeScript doesn't know about `cache_control`, so cached blocks use `satisfies CachedTextBlock` to avoid `@ts-expect-error`.

**GitHub API** — uses `octokit.request(...)` directly (not `octokit.paginate` — broken in `@octokit/rest` v21 with string endpoints).

**FileChange format** returned by LLM:
```ts
{ path: string; content: string; action: "create" | "modify" | "delete" }
```
Full file content is always returned (not diffs). LLM response is parsed by extracting the first `{`…`}` block from the response text.

**Config** — all settings flow through a single typed `Config` object from `src/config.ts`. No module reads `process.env` directly except `config.ts`.

### In-progress iterations

The system is being built iteratively. Completed modules:
- `src/github/issues.ts` — issue fetching + filtering
- `src/llm/issueFilter.ts` — LLM triage filter
- `src/git/workspace.ts` — clone, branch, apply changes, push, cleanup
- `src/llm/fixer.ts` + `src/llm/prompts.ts` — fix generation

Not yet implemented (planned):
- `src/runner/testRunner.ts` — subprocess test execution
- `src/github/pr.ts` — PR creation
- `src/loop/orchestrator.ts` — full per-issue loop with retry
- `src/logger/` — JSONL event log + Markdown report
