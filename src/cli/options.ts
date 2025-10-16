import yargsParser from 'yargs-parser';
import { RepoIdentifier, Selection } from '../types.js';

export type OutputMode = 'table' | 'json' | 'both';

export interface CliOptions {
  repo: RepoIdentifier;
  dryRun: boolean;
  assumeYes: boolean;
  preselected: Selection;
  outputMode: OutputMode;
  mcpUrl?: string;
  rawArgs: string[];
}

const OUTPUT_MODES: OutputMode[] = ['table', 'json', 'both'];

function parseRepoIdentifier(input: string | undefined): RepoIdentifier {
  if (!input) {
    throw new Error('Missing required --repo option (owner/name or https://github.com/owner/name)');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Repository identifier cannot be empty');
  }

  const ownerNameMatch = /^([A-Za-z0-9_.-]+)\/(\S+)$/;
  const urlMatch = /^https?:\/\/github\.com\/([^\s/]+)\/([^\s/#?]+)(?:\.git)?(?:[/#?].*)?$/i;

  let owner: string | undefined;
  let name: string | undefined;

  if (ownerNameMatch.test(trimmed)) {
    const [, o, n] = trimmed.match(ownerNameMatch)!;
    owner = o;
    name = n;
  } else if (urlMatch.test(trimmed)) {
    const [, o, n] = trimmed.match(urlMatch)!;
    owner = o;
    name = n;
  } else {
    throw new Error('Repository must be a GitHub owner/name or URL (https://github.com/owner/name)');
  }

  if (!owner || !name) {
    throw new Error('Unable to parse repository identifier');
  }

  return { owner, name };
}

function parseCommaSeparatedNumbers(value: string | string[] | undefined): number[] {
  if (!value) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((segment) => segment.split(',').map((v) => v.trim()))
    .filter((v) => v.length > 0)
    .map((v) => {
      const num = Number(v);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error(`Invalid PR number: ${v}`);
      }
      return num;
    });
}

function parseCommaSeparatedStrings(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((segment) => segment.split(',').map((v) => v.trim()))
    .filter((v) => v.length > 0);
}

export function parseCliArgs(argv: string[]): CliOptions {
  const parsed = yargsParser(argv.slice(2), {
    string: ['repo', 'output', 'close-pr', 'delete-branch', 'mcp-url'],
    boolean: ['dry-run', 'yes'],
    alias: {
      repo: ['r'],
    },
    configuration: {
      'camel-case-expansion': false,
    },
  });

  const repo = parseRepoIdentifier(parsed.repo as string | undefined);

  const dryRun = Boolean(parsed['dry-run']);
  const assumeYes = Boolean(parsed.yes);
  const outputRaw = (parsed.output as string | undefined)?.toLowerCase() ?? 'table';
  if (!OUTPUT_MODES.includes(outputRaw as OutputMode)) {
    throw new Error(`Invalid output mode: ${outputRaw}. Expected one of ${OUTPUT_MODES.join(', ')}`);
  }
  const outputMode = outputRaw as OutputMode;

  const preselected: Selection = {
    closePrNumbers: parseCommaSeparatedNumbers(parsed['close-pr'] as string | string[] | undefined),
    deleteBranches: parseCommaSeparatedStrings(parsed['delete-branch'] as string | string[] | undefined),
  };

  return {
    repo,
    dryRun,
    assumeYes,
    preselected,
    outputMode,
    mcpUrl: (parsed['mcp-url'] as string | undefined)?.trim() || undefined,
    rawArgs: argv,
  };
}
