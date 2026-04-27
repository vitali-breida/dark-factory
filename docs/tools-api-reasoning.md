# Tools & API Choices

## GitHub API — `@octokit/rest`

**What it does:** official JavaScript/TypeScript client for the GitHub REST API.

**Why chosen:**
- Maintained by GitHub itself — always up to date with API changes
- Full TypeScript types for every endpoint — no manual type declarations
- Handles pagination automatically (`octokit.paginate(...)`)
- Manages auth headers, retries, and rate-limit errors out of the box

**Alternatives considered:**

| Alternative | Why not chosen |
|---|---|
| Raw `fetch` to `api.github.com` | Works, but requires manual auth headers, pagination logic, and type declarations |
| `@octokit/graphql` | GraphQL is more powerful but overkill for our use case; REST is sufficient and simpler |

---

## Git operations — `simple-git`

**What it does:** thin Promise-based wrapper that calls the system `git` binary via `child_process.spawn`.

**Why chosen:**
- Requires no native compilation — just npm install
- Delegates all logic to the real `git` binary, so behavior is identical to what you'd type in a terminal
- Full TypeScript types
- Most widely used Node.js git library for scripting tasks

**Requirement:** `git` must be installed and available in `PATH` — `simple-git` does not bundle it.

**Alternatives considered:**

| Alternative | Why not chosen |
|---|---|
| `child_process.execSync("git ...")` | Works but no types, no structured error handling, string concatenation for args |
| `isomorphic-git` | Pure JS git (no system dependency) but limited functionality and slower |
| `nodegit` | Bindings to libgit2 — powerful but complex native module installation |

**Why not Octokit for git operations:**

Octokit can perform git operations via the GitHub REST API (`createRef`, `createCommit`, `createOrUpdateFileContents`), but doing so requires a multi-step chain of API calls per file:

1. Fetch the current tree SHA
2. Create a blob for each changed file (one request each)
3. Create a new tree referencing those blobs
4. Create a commit pointing to the new tree
5. Update the branch ref

This is 4–5 HTTP requests per file, with each step depending on the result of the previous one. It also has file size limits imposed by the GitHub API.

`simple-git` instead clones the repo locally, writes files directly to disk, and pushes in a single network call — simpler, faster, and without API size constraints.
