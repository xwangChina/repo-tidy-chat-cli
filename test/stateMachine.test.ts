import { describe, it, expect, vi } from 'vitest';
import { runRepoTidyWorkflow } from '../src/workflow/stateMachine';
import { ActionPlan, BranchInfo, PullRequestInfo } from '../src/types';

describe('runRepoTidyWorkflow', () => {
  const repo = { owner: 'octocat', name: 'hello-world' } as const;

  const branches: BranchInfo[] = [
    {
      name: 'main',
      lastCommitSha: 'abc',
      lastCommitAt: '2024-01-01T00:00:00Z',
      isDefault: true,
      isProtected: true,
      linkedPullRequestNumbers: [],
    },
    {
      name: 'feature/cleanup',
      lastCommitSha: 'def',
      lastCommitAt: '2024-01-02T00:00:00Z',
      isDefault: false,
      isProtected: false,
      linkedPullRequestNumbers: [42],
    },
  ];

  const pullRequests: PullRequestInfo[] = [
    {
      number: 42,
      title: 'Clean up',
      headRef: 'feature/cleanup',
      state: 'open',
      canClose: true,
    },
  ];

  it('collects selections, skips protected branches, and returns structured results', async () => {
    const agent = {
      listRepository: vi.fn().mockResolvedValue({
        repo,
        branches,
        pullRequests,
      }),
      executePlan: vi.fn().mockImplementation(async (plan: ActionPlan) => ({
        actions: plan.actions.map((action) => ({
          action,
          status: 'success' as const,
        })),
      })),
    };

    const ui = {
      presentListing: vi.fn().mockResolvedValue(undefined),
      promptForSelection: vi.fn().mockResolvedValue({
        closePrNumbers: [42],
        deleteBranches: ['main', 'feature/cleanup'],
      }),
      confirmExecution: vi.fn().mockResolvedValue(true),
      notifySkipped: vi.fn(),
    };

    const reporter = {
      recordPlan: vi.fn(),
      recordResult: vi.fn(),
      finalize: vi.fn(),
    };

    const summary = await runRepoTidyWorkflow({
      repo,
      dryRun: false,
      assumeYes: false,
      preselected: { closePrNumbers: [], deleteBranches: [] },
      outputMode: 'table',
    }, {
      agent: agent as any,
      ui: ui as any,
      reporter: reporter as any,
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => new Date('2024-01-03T00:00:00Z'),
    });

    expect(agent.listRepository).toHaveBeenCalled();
    expect(ui.presentListing).toHaveBeenCalled();
    expect(ui.promptForSelection).toHaveBeenCalled();
    expect(ui.notifySkipped).toHaveBeenCalledWith({
      type: 'delete-branch',
      target: 'main',
      reason: 'Branch is protected or default and cannot be deleted.',
    });
    expect(agent.executePlan).toHaveBeenCalledWith({
      repo,
      actions: [
        { type: 'close-pr', prNumber: 42 },
        { type: 'delete-branch', branch: 'feature/cleanup' },
      ],
      dryRun: false,
    });

    expect(summary.actions).toEqual([
      { action: { type: 'close-pr', prNumber: 42 }, status: 'success' },
      {
        action: { type: 'delete-branch', branch: 'feature/cleanup' },
        status: 'success',
      },
    ]);
    expect(summary.skipped).toEqual([
      {
        action: { type: 'delete-branch', branch: 'main' },
        reason: 'Branch is protected or default and cannot be deleted.',
      },
    ]);
  });

  it('honors dry-run by bypassing executePlan and marking planned actions', async () => {
    const agent = {
      listRepository: vi.fn().mockResolvedValue({ repo, branches, pullRequests }),
      executePlan: vi.fn(),
    };

    const ui = {
      presentListing: vi.fn(),
      promptForSelection: vi.fn().mockResolvedValue({
        closePrNumbers: [42],
        deleteBranches: ['feature/cleanup'],
      }),
      confirmExecution: vi.fn(),
      notifySkipped: vi.fn(),
    };

    const reporter = {
      recordPlan: vi.fn(),
      recordResult: vi.fn(),
      finalize: vi.fn(),
    };

    const summary = await runRepoTidyWorkflow({
      repo,
      dryRun: true,
      assumeYes: false,
      preselected: { closePrNumbers: [], deleteBranches: [] },
      outputMode: 'json',
    }, {
      agent: agent as any,
      ui: ui as any,
      reporter: reporter as any,
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => new Date('2024-01-03T00:00:00Z'),
    });

    expect(agent.executePlan).not.toHaveBeenCalled();
    expect(summary.actions).toEqual([
      {
        action: { type: 'close-pr', prNumber: 42 },
        status: 'dry-run',
      },
      {
        action: { type: 'delete-branch', branch: 'feature/cleanup' },
        status: 'dry-run',
      },
    ]);
  });
});
