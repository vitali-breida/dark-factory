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
