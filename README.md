# Repo Tidy CLI

`repo-tidy` is a TypeScript CLI that uses the OpenAI Responses API, the Agent SDK, and a hosted GitHub MCP server to help clean up repositories. It lists branches and open pull requests, prompts for actions, and can close pull requests or delete branches (when unprotected) after explicit confirmation. A dry-run mode lets you safely preview planned actions.

## Features

- Connects to the GitHub MCP server using a fine-grained PAT sent as an Authorization bearer header.
- Uses the OpenAI Responses API to orchestrate MCP tool calls for listing, closing pull requests, and deleting branches.
- Interactive TUI prompts with optional non-interactive flags for CI (`--close-pr`, `--delete-branch`).
- `--dry-run` to simulate operations with zero side effects.
- Structured console logs plus a JSON audit saved to `.repo-tidy/last_run.json`.
- Output modes: human-readable tables, JSON, or both.

## Getting Started

```bash
npm install
cp .env.example .env
# populate OPENAI_API_KEY, GITHUB_MCP_URL, GITHUB_MCP_PAT
npm run build
```

Run an interactive dry run:

```bash
npx tsx cmd/repo-tidy.ts --repo owner/repo --dry-run
```

Non-interactive execution (e.g., CI):

```bash
npx tsx cmd/repo-tidy.ts --repo owner/repo --close-pr 12,18 --delete-branch feature/foo --yes
```

## Environment Variables

See `.env.example` for the required configuration. The PAT must include:

- Repository access limited to selected repositories
- Metadata: read
- Contents: read & write
- Pull requests: read & write

`delete_repo` permission is not required.

## Testing

```bash
npm test
```

The project uses Vitest with TypeScript strict mode. Snapshot coverage includes report formatting and planners to keep the state machine safe.

## Safety

- Protected or default branches are never deleted; they are reported as skipped with reasons.
- Dry-run mode short-circuits destructive operations.
- Logs avoid printing secrets and use JSON structure for machine parsing.
