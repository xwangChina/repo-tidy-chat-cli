import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../src/cli/options';

const baseArgv = ['node', 'repo-tidy'];

describe('parseCliArgs', () => {
  it('parses owner/name repo identifier', () => {
    const opts = parseCliArgs([...baseArgv, '--repo', 'octocat/hello-world']);

    expect(opts.repo).toEqual({ owner: 'octocat', name: 'hello-world' });
    expect(opts.dryRun).toBe(false);
    expect(opts.assumeYes).toBe(false);
    expect(opts.outputMode).toBe('table');
  });

  it('parses GitHub URL repo identifier', () => {
    const opts = parseCliArgs([...baseArgv, '--repo', 'https://github.com/foo/bar']);

    expect(opts.repo).toEqual({ owner: 'foo', name: 'bar' });
  });

  it('enables dry-run and assume yes flags', () => {
    const opts = parseCliArgs([
      ...baseArgv,
      '--repo',
      'octocat/hello-world',
      '--dry-run',
      '--yes',
    ]);

    expect(opts.dryRun).toBe(true);
    expect(opts.assumeYes).toBe(true);
  });

  it('parses explicit close PR and delete branch selections', () => {
    const opts = parseCliArgs([
      ...baseArgv,
      '--repo',
      'octocat/hello-world',
      '--close-pr',
      '12,18',
      '--delete-branch',
      'feature/foo,bugfix/bar',
      '--output',
      'both',
      '--mcp-url',
      'https://example-mcp/',
    ]);

    expect(opts.preselected.closePrNumbers).toEqual([12, 18]);
    expect(opts.preselected.deleteBranches).toEqual(['feature/foo', 'bugfix/bar']);
    expect(opts.outputMode).toBe('both');
    expect(opts.mcpUrl).toBe('https://example-mcp/');
  });

  it('rejects invalid repo identifier input', () => {
    expect(() => parseCliArgs([...baseArgv, '--repo', 'https://gitlab.com/foo/bar']))
      .toThrow(/must be a GitHub/);
  });

  it('requires --repo', () => {
    expect(() => parseCliArgs(baseArgv)).toThrow(/--repo/);
  });

  it('rejects invalid output mode', () => {
    expect(() =>
      parseCliArgs([...baseArgv, '--repo', 'octocat/hello-world', '--output', 'xml'])
    ).toThrow(/output/);
  });
});
