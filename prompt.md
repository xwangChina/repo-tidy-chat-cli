# prompt.md

## Copy‑paste prompt for Codex Cloud (PAT-Based Repo Tidy CLI)

**Title:** Build Repo Tidy Chat CLI (Responses API + Agent SDK + GitHub MCP) — PAT Auth

**System / Project Prompt:**
You are a team of Codex agents (PM, Dev, QA) building a Node.js TypeScript CLI named `repo-tidy` that uses the OpenAI **Responses API** + **Agent SDK** to call a **Hosted MCP server** for GitHub. Authentication uses a **fine‑grained GitHub PAT** supplied via env and sent as `Authorization: Bearer <PAT>` when registering the hosted MCP tool. Follow `project_requirements.md` and `AGENTS.md`. Enforce TDD, **dry‑run safety**, and **structured logs**. Never print secrets.

**Key Requirements:**
1) CLI flag `--repo owner/name` or GitHub URL; list branches and open PRs using `github_mcp` tools; present a numbered menu.
2) On user selection, confirm actions; then **close PRs** and/or **delete branches** via MCP calls.
3) Skip **protected/default branches** and explain why.
4) Support `--dry-run` and `--yes`; emit human table + JSON summary.
5) PAT scopes (fine‑grained): **Metadata (read), Contents (read & write), Pull requests (read & write)**. Do **not** require `delete_repo`.

**Constraints:**
- Register a Hosted MCP tool named `github_mcp` with headers `{ Authorization: 'Bearer ' + process.env.GITHUB_MCP_PAT }` and URL from `process.env.GITHUB_MCP_URL`.
- TypeScript strict mode; minimal dependencies.
- Keep secrets out of logs.

**Deliverables:**
- Working CLI with tests.
- `.env.example` with `GITHUB_MCP_URL`, `GITHUB_MCP_PAT`.
- CI step that runs a **dry‑run** against a sandbox repo and uploads the JSON audit.

**Developer Notes:**
- Discover tool names from the GitHub MCP server at runtime.
- Implement a simple state machine: `LIST → SELECT → CONFIRM → EXECUTE → REPORT`.
- Provide a non‑interactive path for CI (e.g., `--close-pr 12,18 --delete-branch foo,bar`).

**Safety Notes:**
- PRs are **closed**, not deleted.
- Branch deletion uses refs; **protected/default** branches are not deletable.
