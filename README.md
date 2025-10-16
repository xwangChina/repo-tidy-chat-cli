# Repo Tidy CLI

`repo-tidy` is a Node.js TypeScript command line tool that uses the OpenAI Responses API and the Agent SDK to coordinate with the GitHub hosted MCP server. It lists branches and open pull requests for a GitHub repository and helps you close PRs or delete stale branches safely.

## Features

- Register the hosted `github_mcp` server using a fine-grained PAT sent as an `Authorization: Bearer` header.
- Discover branches and open PRs, including protection/default metadata and linked PR numbers.
- Interactive TUI for selecting branches/PRs, with non-interactive flags for CI automation.
- State machine (`LIST → SELECT → CONFIRM → EXECUTE → REPORT`) enforcing confirmations and dry-run support.
- Structured JSON logs plus human-readable tables and JSON audits written to `.repo-tidy/last_run.json`.

## Requirements

- Node.js 18+
- Fine-grained GitHub PAT with permissions:
  - Repository access: only the repositories you need
  - Repository permissions: Metadata (read), Contents (read & write), Pull requests (read & write)
- OpenAI API key with access to a Responses API reasoning model (default `gpt-5-reasoning`).
- Hosted GitHub MCP server URL (see [mcpservers.org](https://mcpservers.org)).

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in values:
   ```bash
   cp env.example .env
   ```
3. Run the tests:
   ```bash
   npm test
   ```
4. Build the CLI (outputs to `dist/`):
   ```bash
   npm run build
   ```

## Usage

```bash
npx tsx cmd/repo-tidy.ts --repo owner/repo-name [options]
```

### Key Flags

- `--repo owner/name` or `--repo https://github.com/owner/name` – required.
- `--dry-run` – simulate actions without calling mutating MCP methods.
- `--yes` – skip the confirmation prompt (auto-enabled during `--dry-run`).
- `--close-pr 12,18` – close the listed pull request numbers non-interactively.
- `--delete-branch feature/foo,bugfix/bar` – delete the specified branches (skipping protected/default ones).
- `--mcp-url https://...` – override the MCP server URL (defaults to `GITHUB_MCP_URL`).
- `--output table|json|both` – select output format (default `table`).

When running interactively the CLI will:
1. List branches and PRs using the hosted MCP server via OpenAI Responses.
2. Prompt for PR numbers/branches to act on.
3. Confirm actions unless `--yes` is set or it is a dry run.
4. Execute the plan (or simulate it in dry-run mode) and render a human table plus a JSON audit.

### CI Automation

Use the non-interactive flags to pre-select actions and skip confirmation. Example dry-run suitable for CI:
```bash
npx tsx cmd/repo-tidy.ts \
  --repo your-org/sandbox \
  --close-pr 123 \
  --delete-branch cleanup/temp \
  --dry-run \
  --yes \
  --output both
```
The JSON audit is written to `.repo-tidy/last_run.json`; upload it as a CI artifact.

## Development

- Tests are written with [Vitest](https://vitest.dev). Add failing tests before implementing fixes or features.
- Logs are structured JSON lines. Avoid logging secrets.
- Run `npm test` and `npm run build` before sending a PR.

## Safety Notes

- Branch protection/default branches are always skipped with an explanation.
- Pull requests are closed (not deleted). Branch deletion uses Git refs via MCP.
- Dry-run mode never mutates GitHub and is recommended for CI verification.
