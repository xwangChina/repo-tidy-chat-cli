import OpenAI from "openai";

import { logStructured } from "../logging/structured";
import { registerGithubMcp } from "../mcp/github";
import type { HostedMcpTool } from "../mcp/github";
import type { RepoIdentifier } from "../types/models";

interface RepoInventoryResponse {
  branches: Array<{
    name: string;
    commitSha: string;
    updatedAt: string;
    isDefault: boolean;
    isProtected: boolean;
  }>;
  pullRequests: Array<{
    number: number;
    title: string;
    state: string;
    headRef: string;
    url: string;
    draft: boolean;
  }>;
}

interface ClosePrResponse {
  results: Array<{
    number: number;
    status: "success" | "skipped" | "failed";
    reason?: string;
  }>;
}

interface DeleteBranchResponse {
  results: Array<{
    name: string;
    status: "success" | "skipped" | "failed";
    reason?: string;
  }>;
}

interface RepoTidyAgentOptions {
  apiKey?: string;
  model?: string;
  githubPat?: string;
  githubMcpUrl?: string;
  toolName?: string;
}

export class RepoTidyAgent {
  private readonly client: OpenAI;

  private readonly model: string;

  private readonly tool: HostedMcpTool;

  private readonly systemPrompt =
    "You are the Repo Tidy CLI agent. Use the `github_mcp` tool to list repository data, close pull requests, and delete branches. Always obey branch protections and respond with JSON when asked.";

  constructor(options: RepoTidyAgentOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    this.client = new OpenAI({ apiKey });

    this.tool = registerGithubMcp({
      url: options.githubMcpUrl,
      pat: options.githubPat,
      name: options.toolName,
    });
  }

  async listRepository(repo: RepoIdentifier): Promise<RepoInventoryResponse> {
    logStructured({ event: "agent.list.start", data: { repo } });
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.systemPrompt,
      tools: [this.tool],
      input: `List all branches (name, commit SHA, last update ISO timestamp, default flag, protected flag) and open pull requests (number, title, state, head ref, url, draft flag) for the GitHub repository ${repo.owner}/${repo.name}. Respond with a strict JSON object containing arrays 'branches' and 'pullRequests' with the described fields.`,
    });

    const inventory = this.parseJson<RepoInventoryResponse>(response.output_text);
    logStructured({
      event: "agent.list.success",
      data: { branchCount: inventory.branches.length, prCount: inventory.pullRequests.length },
    });
    return inventory;
  }

  async closePullRequests(repo: RepoIdentifier, prNumbers: number[]): Promise<ClosePrResponse["results"]> {
    if (prNumbers.length === 0) {
      return [];
    }
    logStructured({ event: "agent.close_pr.start", data: { repo, count: prNumbers.length } });
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.systemPrompt,
      tools: [this.tool],
      input: `Close the following pull requests in ${repo.owner}/${repo.name}: ${prNumbers.join(", ")}. Use the github_mcp tool to perform the actions. Respond with a JSON object {"results": [{"number": <int>, "status": "success"|"skipped"|"failed", "reason": <string optional>}]} reporting each number.`,
    });

    const parsed = this.parseJson<ClosePrResponse>(response.output_text);
    logStructured({ event: "agent.close_pr.success", data: { count: parsed.results.length } });
    return parsed.results;
  }

  async deleteBranches(repo: RepoIdentifier, branches: string[]): Promise<DeleteBranchResponse["results"]> {
    if (branches.length === 0) {
      return [];
    }
    logStructured({ event: "agent.delete_branch.start", data: { repo, count: branches.length } });
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.systemPrompt,
      tools: [this.tool],
      input: `Delete the following Git refs in ${repo.owner}/${repo.name}: ${branches.join(", ")}. Use github_mcp delete branch tools. Confirm each deletion succeeded or report a failure reason. Respond with a JSON object {"results": [{"name": <string>, "status": "success"|"skipped"|"failed", "reason": <string optional>}]} and never include protected or default branches.`,
    });

    const parsed = this.parseJson<DeleteBranchResponse>(response.output_text);
    logStructured({ event: "agent.delete_branch.success", data: { count: parsed.results.length } });
    return parsed.results;
  }

  private parseJson<T>(raw: string | null): T {
    if (!raw) {
      throw new Error("Agent response did not include output_text");
    }
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      logStructured({ event: "agent.parse_json.error", level: "error", error: error as Error });
      throw error;
    }
  }
}
