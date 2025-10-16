/**
 * src/mcp/registerGithubMcp.ts
 *
 * Helper to register the GitHub MCP server as a Hosted MCP tool
 * for the OpenAI Agent SDK. Uses a fine-grained GitHub PAT supplied
 * via env as an Authorization: Bearer header.
 *
 * Usage (Agent SDK sketch):
 *
 *   import OpenAI from "@openai/agents";
 *   import { registerGithubMcp } from "./mcp/registerGithubMcp";
 *
 *   const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
 *   const agent = await client.agents.create({
 *     name: "Repo Tidy",
 *     model: process.env.OPENAI_MODEL ?? "gpt-5-reasoning",
 *     tools: [registerGithubMcp()], // adds the hosted MCP tool
 *     systemPrompt: "Use `github_mcp` to list branches & PRs; ask for explicit confirmation before closing PRs or deleting non-protected branches."
 *   });
 */

export type HostedMCPTool = {
  type: "mcp";
  name: string;
  server:
    | {
        // Hosted HTTP/S MCP server
        kind: "hosted";
        url: string;
        headers?: Record<string, string>;
      }
    | {
        // Local stdio MCP server (not used by default here)
        kind: "stdio";
        command: string;
        args?: string[];
        env?: Record<string, string>;
      };
};

/**
 * Resolve required env vars and build a Hosted MCP tool config for GitHub.
 * Throws if required variables are missing.
 */
export function registerGithubMcp(opts?: {
  /** Override the hosted MCP URL; defaults to process.env.GITHUB_MCP_URL */
  url?: string;
  /** Override the PAT; defaults to process.env.GITHUB_MCP_PAT */
  pat?: string;
  /** Override the tool name (default: "github_mcp") */
  name?: string;
  /** Extra headers to merge (Authorization header will be set from PAT) */
  headers?: Record<string, string>;
}): HostedMCPTool {
  const url = (opts?.url ?? process.env.GITHUB_MCP_URL)?.trim();
  const pat = (opts?.pat ?? process.env.GITHUB_MCP_PAT)?.trim();
  const name = (opts?.name ?? "github_mcp").trim();

  if (!url) {
    throw new Error("GITHUB_MCP_URL is required (set env or pass opts.url)");
  }
  if (!pat) {
    throw new Error("GITHUB_MCP_PAT is required (set env or pass opts.pat)");
  }
  if (/\s/.test(pat)) {
    throw new Error("GITHUB_MCP_PAT contains whitespace; check your .env formatting.");
  }

  // Build Authorization header safely
  const headers: Record<string, string> = {
    Authorization: `Bearer ${pat}`,
    ...(opts?.headers ?? {}),
  };

  return {
    type: "mcp",
    name,
    server: {
      kind: "hosted",
      url,
      headers,
    },
  };
}

/**
 * Optional helper to validate that the PAT has likely minimal scopes.
 * (This is a local check and does not verify against GitHub APIs.)
 *
 * Recommended fine-grained PAT permissions:
 * - Repository access: Only selected repositories
 * - Repository permissions:
 *   * Metadata → Read-only
 *   * Contents → Read & Write
 *   * Pull requests → Read & Write
 *
 * `delete_repo` is NOT required (and should not be granted).
 */
export function printPatScopeGuidance(): void {
  // Purely informational; do not log secrets.
  // Provide a one-liner reminder for developers.
  // Avoid printing the PAT value.
  // eslint-disable-next-line no-console
  console.info(
    "[Repo Tidy] Ensure your fine-grained PAT has: Metadata(read), Contents(read&write), Pull requests(read&write). Avoid `delete_repo`."
  );
}
