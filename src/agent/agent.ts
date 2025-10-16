import OpenAI from 'openai';
import { registerGithubMcp } from '../mcp/github.js';
import {
  RepoTidyAgent,
  RepoIdentifier,
  AgentListResponse,
  ActionPlan,
  ActionExecutionResult,
  Logger,
  RepoAction,
} from '../types.js';

interface AgentConfig {
  apiKey?: string;
  model?: string;
  mcpUrl?: string;
  pat?: string;
  logger: Logger;
}

type JsonSchema = Record<string, unknown>;

function createOpenAiClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

function extractTextPayload(response: any): string {
  if (!response) {
    throw new Error('Empty response from OpenAI');
  }
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }
  const candidates: string[] = [];
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (Array.isArray(item.content)) {
        for (const content of item.content) {
          if (typeof content.text === 'string') {
            candidates.push(content.text);
          }
          if (Array.isArray(content.text)) {
            candidates.push(content.text.join('\n'));
          }
        }
      }
    }
  }
  if (Array.isArray(response.content)) {
    for (const content of response.content) {
      if (typeof content.text === 'string') {
        candidates.push(content.text);
      }
      if (Array.isArray(content.text)) {
        candidates.push(content.text.join('\n'));
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error('Unable to extract text payload from OpenAI response');
  }
  return candidates.join('\n').trim();
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response from OpenAI: ${(error as Error).message}`);
  }
}

const LIST_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    branches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          lastCommitSha: { type: 'string' },
          lastCommitAt: { type: 'string' },
          isDefault: { type: 'boolean' },
          isProtected: { type: 'boolean' },
          linkedPullRequestNumbers: {
            type: 'array',
            items: { type: 'integer' },
          },
        },
        required: [
          'name',
          'lastCommitSha',
          'lastCommitAt',
          'isDefault',
          'isProtected',
          'linkedPullRequestNumbers',
        ],
      },
    },
    pullRequests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          title: { type: 'string' },
          headRef: { type: 'string' },
          state: { type: 'string' },
          canClose: { type: 'boolean' },
        },
        required: ['number', 'title', 'headRef', 'state', 'canClose'],
      },
    },
  },
  required: ['branches', 'pullRequests'],
};

const EXECUTE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              prNumber: { type: 'integer' },
              branch: { type: 'string' },
            },
            required: ['type'],
          },
          status: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['action', 'status'],
      },
    },
    errors: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['actions'],
};

export class OpenAIRepoTidyAgent implements RepoTidyAgent {
  private readonly client: ReturnType<typeof createOpenAiClient>;
  private readonly model: string;
  private readonly logger: Logger;
  private readonly tools: unknown[];

  constructor(config: AgentConfig) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for Repo Tidy agent');
    }
    this.client = createOpenAiClient(apiKey);
    this.model = config.model ?? process.env.OPENAI_MODEL ?? 'gpt-5-reasoning';
    this.logger = config.logger;

    const tool = registerGithubMcp({ url: config.mcpUrl, pat: config.pat });
    this.tools = [tool];
  }

  private async callJsonSchema<T>(params: {
    system: string;
    user: string;
    schema: JsonSchema;
  }): Promise<T> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      tools: this.tools,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'repo_tidy_payload',
          schema: params.schema,
        },
      },
    } as any);

    const text = extractTextPayload(response);
    return parseJson<T>(text);
  }

  async listRepository(repo: RepoIdentifier): Promise<AgentListResponse> {
    this.logger.info('agent-list', { repo });
    const payload = await this.callJsonSchema<AgentListResponse>({
      system:
        'You are Repo Tidy, a GitHub cleanup assistant. Always use the `github_mcp` tool to gather repository metadata before responding. Return JSON that matches the provided schema.',
      user: `List all branches and open pull requests for the repository ${repo.owner}/${repo.name}. Include branch protection status and link pull request numbers to branches.`,
      schema: LIST_SCHEMA,
    });
    return { ...payload, repo };
  }

  async executePlan(plan: ActionPlan): Promise<{ actions: ActionExecutionResult[]; errors?: string[] }> {
    this.logger.info('agent-execute', { repo: plan.repo, actionCount: plan.actions.length, dryRun: plan.dryRun });
    const payload = await this.callJsonSchema<{ actions: { action: RepoAction; status: string; message?: string }[]; errors?: string[] }>({
      system:
        'You are Repo Tidy, a GitHub cleanup assistant. When instructed you must use the `github_mcp` tool to close pull requests and delete branches. Respect protected or default branches. Return JSON that matches the provided schema.',
      user: `Execute the following plan for ${plan.repo.owner}/${plan.repo.name}. Dry run: ${plan.dryRun}. Plan actions: ${JSON.stringify(plan.actions)}. Use the github_mcp tool to close PRs and delete branches when dryRun is false. When dryRun is true, simulate the outcome without applying changes.`,
      schema: EXECUTE_SCHEMA,
    });

    const actions: ActionExecutionResult[] = payload.actions.map((item) => ({
      action: item.action,
      status:
        item.status === 'success' || item.status === 'failed' || item.status === 'dry-run'
          ? (item.status as ActionExecutionResult['status'])
          : 'failed',
      message: item.message,
    }));

    return { actions, errors: payload.errors };
  }
}
