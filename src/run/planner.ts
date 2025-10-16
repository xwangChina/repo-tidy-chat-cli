import type { BranchInfo } from "../types/models";

interface ComputeExecutableActionsArgs {
  branches: BranchInfo[];
  selectedDeleteBranches: string[];
  dryRun: boolean;
}

interface ComputeExecutableActionsResult {
  deleteBranches: string[];
  skippedBranches: Array<{ name: string; reason: string }>;
}

export function computeExecutableActions(
  args: ComputeExecutableActionsArgs,
): ComputeExecutableActionsResult {
  const { branches, selectedDeleteBranches, dryRun } = args;
  const branchMap = new Map(branches.map((branch) => [branch.name, branch]));
  const deleteBranches: string[] = [];
  const skippedBranches: Array<{ name: string; reason: string }> = [];

  for (const branchName of selectedDeleteBranches) {
    const branch = branchMap.get(branchName);
    if (!branch) {
      skippedBranches.push({ name: branchName, reason: "not-found" });
      continue;
    }
    if (branch.isDefault || branch.isProtected) {
      skippedBranches.push({ name: branchName, reason: "protected" });
      continue;
    }
    if (dryRun) {
      skippedBranches.push({ name: branchName, reason: "dry-run" });
      continue;
    }
    deleteBranches.push(branchName);
  }

  return { deleteBranches, skippedBranches };
}

export type { ComputeExecutableActionsArgs, ComputeExecutableActionsResult };
