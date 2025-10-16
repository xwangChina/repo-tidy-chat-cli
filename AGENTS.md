# AGENTS.md

## Collaboration Guide for **Repo Tidy Chat CLI** (PAT-Based Auth)

### Roles
- **PM Agent** — plan, groom tasks, maintain `docs/SPRINT_NOTES.md`.
- **Dev Agent** — implement features via TDD; keep diffs small; wire Agent SDK + MCP.
- **QA Agent** — write tests, run dry‑run flows against a sandbox repo, record `QA_REPORT.md`.

### Working Agreements
- **Authentication:** Use a **fine‑grained GitHub PAT** for all development and tests.
  - Repository access: **Only selected repositories**.
  - Permissions: **Metadata (read)**, **Contents (read & write)**, **Pull requests (read & write)**.
  - **Never** request or use `delete_repo` — it deletes whole repositories and is not needed.
- **Secrets handling:**
  - PAT goes in local env/secret manager only. **Never** commit or echo.
  - Use `.env.example` for variable names; add `.env` to `.gitignore`.
- **Safety:**
  - Destructive ops require explicit confirmation. In CI, default to `--dry-run`.
- **Branching:**
  - `feat/<ticket>-slug`, `fix/<ticket>-slug`; squash merge to `main`.
- **Commits:** Conventional commits (e.g., `feat(cli): interactive menu for PR close`).

### Task Workflow
1. PM Agent creates up to 3 **Ready** tasks.
2. QA/Dev add failing tests first in `/test` (menu parsing, list formatting, action planner).
3. Dev implements code; wires Hosted MCP with `Authorization: Bearer <PAT>` header.
4. QA runs:
   ```bash
   npx tsx cmd/repo-tidy.ts --repo owner/sandbox --dry-run --output both
   npm test
   ```
5. PM reviews JSON audit + console output; merges if green.

### Testing
- **Unit:** input parsing, selection, confirmation, report formatting.
- **Integration:** Hosted MCP listing (read‑only) and dry‑run execution against a sandbox repo.
- **Snapshots:** table output and JSON audit.

### Definition of Done (per task)
- Tests added and passing.
- Types strict; no `any` creep.
- Logs structured; no secrets in output.
