import { createInterface } from "node:readline/promises";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";

import { formatBranchTable, formatPrTable } from "../run/report";
import type { BranchInfo, PullRequestInfo, SelectedActions } from "../types/models";

interface PromptSelectionsArgs {
  branches: BranchInfo[];
  pullRequests: PullRequestInfo[];
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export async function promptForSelections(args: PromptSelectionsArgs): Promise<SelectedActions> {
  const { branches, pullRequests } = args;
  const input = args.input ?? defaultInput;
  const output = args.output ?? defaultOutput;

  const rl = createInterface({ input, output });

  try {
    const branchTable = formatBranchTable(branches);
    const prTable = formatPrTable(pullRequests);

    output.write(`\nBranches\n${branchTable}\n\n`);
    output.write(`Pull Requests\n${prTable}\n\n`);

    const prAnswer = await rl.question(
      "Enter PR numbers to close (comma separated, blank to skip): ",
    );
    const closePrs = prAnswer
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error(`Invalid PR number: ${value}`);
        }
        return parsed;
      });

    const branchAnswer = await rl.question(
      "Enter branches to delete (comma separated, blank to skip): ",
    );
    const deleteBranches = branchAnswer
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return { closePrs, deleteBranches };
  } finally {
    rl.close();
  }
}

interface PromptConfirmArgs {
  message: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  defaultYes?: boolean;
}

export async function promptForConfirmation(args: PromptConfirmArgs): Promise<boolean> {
  const { message } = args;
  const input = args.input ?? defaultInput;
  const output = args.output ?? defaultOutput;
  const rl = createInterface({ input, output });
  try {
    const suffix = args.defaultYes ? "[Y/n]" : "[y/N]";
    const answer = await rl.question(`${message} ${suffix} `);
    if (!answer.trim()) {
      return Boolean(args.defaultYes);
    }
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}
