# project_requirements.md

## Project: **Repo Tidy Chat CLI** (OpenAI Responses API + Agent SDK + GitHub MCP) — **PAT-Based Auth**

### 1) Problem Statement
Engineering teams accumulate stale branches and dangling PRs. We want a **command‑line chat tool** that connects to GitHub via a **public Remote MCP server**, lists branches and open PRs for a given repository, and (with explicit user confirmation) **closes PRs** and **deletes branches** when allowed.

### 2) Decision Record — Authentication
- **Auth mechanism:** **GitHub fine‑grained Personal Access Token (PAT)**.
- **Reasoning:** Fastest local development; least moving parts; easy to rotate and scope tightly for a single user. OAuth may be added later for multi-user or hosted web UI, but is **out of scope for v1**.
- **Minimum permissions (Fine‑grained PAT):**
  - **Repository access:** *Only selected repositories* (choose the target repos).
  - **Repository permissions:**
    - **Metadata → Read‑only** (safe default; often implicitly required)
    - **Contents → Read & Write** (required to **delete branches** and read branches)
    - **Pull requests → Read & Write** (required to **close PRs**)
  - **Not required:** `delete_repo` (that deletes entire repositories and is **not** needed for branch cleanup).
- **Classic PAT (alternative):** Use the coarse `repo` scope if you must (private repos). Avoid `delete_repo`.

### 3) Goals & Non‑Goals
**Goals**
- Conversational CLI that:
  - Accepts a repo id (`owner/name`) or URL.
  - Lists **branches** and **open PRs**, showing branch↔PR mapping.
  - Lets the user select items to **close PRs** and/or **delete branches**.
  - Executes operations via the **GitHub MCP server** (Hosted or Local).
  - Prints a final human report and a JSON audit file.

**Non‑Goals (v1)**
- OAuth sign‑in and multi‑user session management.
- Deleting repositories, force‑pushing, or changing branch protections.

### 4) User Stories & Acceptance Criteria
**US-1 List**
- *As a maintainer*, I run `repo-tidy --repo owner/name` and get tables of branches and open PRs.
- **AC:** Output includes branch name, last commit SHA/time, protected/default flags; PR number/title/state/head branch.

**US-2 Choose actions**
- *As a maintainer*, I choose PRs to close and/or branches to delete.
- **AC:** Tool asks for **explicit confirmation** and echoes the exact targets; supports `--yes` flag.

**US-3 Execute**
- *As a maintainer*, I confirm and the tool performs the actions via MCP.
- **AC:** PRs end in `closed` state; branches deleted via ref deletion when not protected; protected/default branches are skipped with a reason.

**US-4 Safety**
- *As a maintainer*, I can run `--dry-run`.
- **AC:** The tool simulates operations, showing what would be done without changing GitHub state.

**US-5 Audit**
- *As a maintainer*, I receive a machine‑readable log.
- **AC:** JSON summary written to `./.repo-tidy/last_run.json` (inputs, actions, results, errors).

### 5) Architecture & Components
- **CLI (Node.js + TypeScript)**
  - Binary: `repo-tidy`.
  - Flags: `--repo`, `--dry-run`, `--yes`, `--mcp-url`, `--output`.
  - Interactive menu in TTY; non‑interactive flags for CI.
- **Agent Orchestrator (Agent SDK)**
  - Registers a **Hosted MCP server** tool named `github_mcp` pointing to the GitHub MCP endpoint.
  - Sends prompts to the Responses API; the model discovers and calls MCP tools to list/act.
- **Model (OpenAI Responses API)**
  - Reasoning + tool calling to fetch lists, ask for confirmation, then execute actions.

### 6) Data Flow (Happy Path)
1. CLI bootstraps env (reads `GITHUB_MCP_PAT`, `GITHUB_MCP_URL`) and user args.
2. Agent registers **Hosted MCP** with an `Authorization: Bearer <PAT>` header.
3. Model calls MCP tools to list branches and PRs.
4. CLI presents menu; user selects and confirms.
5. Model calls MCP tools to close PRs / delete branches.
6. CLI prints summary; writes JSON audit.

### 7) Error Handling & Edge Cases
- **Protected/default branches:** skip with reason; never attempt deletion.
- **PRs:** cannot be deleted—only closed.
- **Permissions (403):** instruct user to add **Contents: Read & Write** and **Pull requests: Read & Write** to the PAT scoped to the repo.
- **Rate limits / 5xx:** retry with exponential backoff (bounded).
- **Network / discovery issues:** clear error and exit non‑zero.

### 8) Configuration
Environment variables:
```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-reasoning
GITHUB_MCP_URL=...                 # GitHub MCP endpoint from mcpservers.org or your local server
GITHUB_MCP_PAT=ghp_********        # Fine‑grained PAT (scoped as above)
REPO_TIDY_ASSUME_YES=false
REPO_TIDY_DRY_RUN=false
```

CLI flags:
```
--repo owner/name | https://github.com/owner/name
--dry-run
--yes
--mcp-url <url>
--output json|table|both
```

### 9) Security
- PAT stored only in local env/secret manager; **never** printed or logged.
- Confirm destructive actions; `--dry-run` by default in CI.
- Limit PAT to selected repos and minimal permissions.

### 10) Observability
- Structured logs (JSON): tool name, latency, items, outcomes.
- JSON audit artifact checked into CI as a build artifact (not the token).

### 11) Performance Targets
- List step < 5s for ≤ 200 branches and ≤ 100 open PRs (network dependent).

### 12) Deliverables
- `/cmd/repo-tidy.ts` (CLI)
- `/src/agent/agent.ts` (Agent SDK + Responses orchestration)
- `/src/mcp/github.ts` (Hosted MCP registration helper)
- `/src/ui/menus.ts` (TTY UX)
- `/src/run/report.ts` (formatter + JSON audit)
- Tests in `/test`, docs: `project_requirements.md`, `AGENTS.md`, `prompt.md`, `setup_instructions.md`.

### 13) Definition of Done (v1)
- ACs pass in a test repo.
- Dry‑run works; protected/default branches skipped safely.
- JSON audit produced; README snippet shows an example session.
