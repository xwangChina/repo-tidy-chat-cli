export type HostedMCPTool = {
  type: 'mcp';
  name: string;
  server:
    | {
        kind: 'hosted';
        url: string;
        headers?: Record<string, string>;
      }
    | {
        kind: 'stdio';
        command: string;
        args?: string[];
        env?: Record<string, string>;
      };
};

export interface RegisterGithubMcpOptions {
  url?: string;
  pat?: string;
  name?: string;
  headers?: Record<string, string>;
}

export function registerGithubMcp(opts?: RegisterGithubMcpOptions): HostedMCPTool {
  const url = (opts?.url ?? process.env.GITHUB_MCP_URL)?.trim();
  const pat = (opts?.pat ?? process.env.GITHUB_MCP_PAT)?.trim();
  const name = (opts?.name ?? 'github_mcp').trim();

  if (!url) {
    throw new Error('GITHUB_MCP_URL is required (set env or pass opts.url)');
  }
  if (!pat) {
    throw new Error('GITHUB_MCP_PAT is required (set env or pass opts.pat)');
  }
  if (/\s/.test(pat)) {
    throw new Error('GITHUB_MCP_PAT contains whitespace; check your .env formatting.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${pat}`,
    ...(opts?.headers ?? {}),
  };

  return {
    type: 'mcp',
    name,
    server: {
      kind: 'hosted',
      url,
      headers,
    },
  };
}

export function printPatScopeGuidance(): void {
  console.info(
    '[Repo Tidy] Ensure your fine-grained PAT has: Metadata(read), Contents(read&write), Pull requests(read&write). Avoid `delete_repo`.')
  ;
}
