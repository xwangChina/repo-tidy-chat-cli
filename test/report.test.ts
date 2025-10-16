import { describe, it, expect } from 'vitest';
import { buildHumanReport, buildJsonSummary } from '../src/run/report';
import { RunSummary } from '../src/types';

describe('report builders', () => {
  const summary: RunSummary = {
    repo: { owner: 'octocat', name: 'hello-world' },
    dryRun: false,
    startedAt: '2024-01-03T00:00:00.000Z',
    completedAt: '2024-01-03T00:05:00.000Z',
    listing: {
      branches: [
        {
          name: 'main',
          lastCommitSha: 'abc',
          lastCommitAt: '2024-01-01T00:00:00Z',
          isDefault: true,
          isProtected: true,
          linkedPullRequestNumbers: [],
        },
      ],
      pullRequests: [
        {
          number: 42,
          title: 'Clean up',
          headRef: 'feature/cleanup',
          state: 'open',
          canClose: true,
        },
      ],
    },
    plannedActions: [
      { type: 'close-pr', prNumber: 42 },
      { type: 'delete-branch', branch: 'feature/cleanup' },
    ],
    actions: [
      { action: { type: 'close-pr', prNumber: 42 }, status: 'success' },
      { action: { type: 'delete-branch', branch: 'feature/cleanup' }, status: 'success' },
    ],
    skipped: [
      {
        action: { type: 'delete-branch', branch: 'main' },
        reason: 'Branch is protected or default and cannot be deleted.',
      },
    ],
    errors: [],
  };

  it('produces a human-readable report table', () => {
    const table = buildHumanReport(summary);

    expect(table).toContain('Repo Tidy Summary');
    expect(table).toContain('close-pr #42');
    expect(table).toContain('delete-branch feature/cleanup');
    expect(table).toContain('SKIPPED');
  });

  it('produces a JSON summary ready for audit file', () => {
    const json = buildJsonSummary(summary);

    expect(json.repo).toEqual(summary.repo);
    expect(json.actions).toHaveLength(2);
    expect(json.skipped[0].reason).toMatch(/protected/);
  });
});
