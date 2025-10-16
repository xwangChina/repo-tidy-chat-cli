# setup_instructions.md

## Setup — GitHub MCP + PAT for Repo Tidy Chat CLI

This project uses a **fine‑grained GitHub Personal Access Token (PAT)** to authenticate to the **GitHub MCP server**. OAuth is out of scope for v1.

---

## 1) Prerequisites
- Node.js 20+
- OpenAI API key with Responses access
- A GitHub account with access to the target repositories

---

## 2) Create a **fine‑grained** PAT
1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine‑grained tokens**.
2. **Repository access:** select **Only selected repositories**, then pick the repos you’ll manage.
3. **Repository permissions:**
   - **Metadata → Read‑only**
   - **Contents → Read and write** (needed for branch deletion and reading branches)
   - **Pull requests → Read and write** (needed to close PRs)
4. Set a **short expiration** (7–30 days is good for dev) and create the token.
5. Copy the token (looks like `ghp_********`). Keep it secret.

> ❌ **Do not enable** `delete_repo`. That scope deletes entire repositories and is not required for branch cleanup.

---

## 3) Configure environment variables
Create a `.env` file (never commit it):
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-reasoning

# GitHub MCP (Hosted or Local)
GITHUB_MCP_URL=<your GitHub MCP endpoint URL>
GITHUB_MCP_PAT=ghp_********
```

- If you are running a **local** GitHub MCP server (Docker or binary), follow that server’s README and set `GITHUB_MCP_URL` accordingly.
- For a **hosted** MCP, use the endpoint URL from the server’s listing/documentation.

---

## 4) Wire the Hosted MCP tool (TypeScript)
Example registration helper:
```ts
// src/mcp/github.ts
export function githubMcpToolConfig() {
  const url = process.env.GITHUB_MCP_URL;
  const pat = process.env.GITHUB_MCP_PAT;
  if (!url || !pat) {
    throw new Error("GITHUB_MCP_URL and GITHUB_MCP_PAT are required");
  }
  return {
    type: "mcp",
    name: "github_mcp",
    server: {
      kind: "hosted",
      url,
      headers: { Authorization: `Bearer ${pat}` },
    },
  } as const;
}
```

Use it in the Agent SDK setup:
```ts
// src/agent/agent.ts
import OpenAI from "@openai/agents";
import { githubMcpToolConfig } from "../mcp/github";

export async function createRepoTidyAgent(model: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client.agents.create({
    name: "Repo Tidy",
    model,
    tools: [githubMcpToolConfig()],
    systemPrompt:
      "Use `github_mcp` to list branches and PRs. Ask for explicit confirmation before closing PRs or deleting non-protected branches. Never print secrets.",
  });
}
```

---

## 5) Install & run
```bash
# install deps
npm i

# first run (safe)
npx tsx cmd/repo-tidy.ts --repo owner/sandbox --dry-run --output both
```

Expected behavior: lists branches and open PRs; creates a JSON audit under `./.repo-tidy/last_run.json`.

---

## 6) Execute actions (with confirmation)
```bash
npx tsx cmd/repo-tidy.ts --repo owner/sandbox
# The tool will present a menu; confirm the exact PRs/branches to act on.
```

Non‑interactive (CI) example:
```bash
npx tsx cmd/repo-tidy.ts --repo owner/sandbox   --close-pr 12,18 --delete-branch stale/foo,stale/bar --yes --output both
```

---

## 7) Troubleshooting
- **401/403:** Check the PAT scopes. You need **Contents (read & write)** and **Pull requests (read & write)** on the selected repo(s).
- **Protected/default branch:** GitHub will refuse deletion; the CLI should report the reason and skip.
- **Tool discovery or networking issues:** verify `GITHUB_MCP_URL` is correct and outbound HTTPS is allowed.
- **Rate limiting:** re-run later; the tool uses bounded backoff.

---

## 8) Security Notes
- Store PATs in your local keychain or a secrets manager; never print them.
- Keep `.env` out of git; commit `.env.example` only.
- Consider shorter token lifetimes and rotate regularly.

---

## 9) Optional — Run a local GitHub MCP server
If you prefer local instead of hosted:
- **Docker:**
  ```bash
  docker run -i --rm     -e GITHUB_PERSONAL_ACCESS_TOKEN=$GITHUB_MCP_PAT     ghcr.io/github/github-mcp-server
  ```
- Then set `GITHUB_MCP_URL` to the local server endpoint exposed by the container.

(Refer to the GitHub MCP server README for advanced options like restricting toolsets.)

---

That’s it — you’re ready to run the Repo Tidy Chat CLI with **PAT-based** MCP access.
