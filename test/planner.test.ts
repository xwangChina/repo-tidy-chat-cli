import { describe, expect, it } from "vitest";
import { computeExecutableActions } from "../src/run/planner";
import type { BranchInfo } from "../src/types/models";

describe("computeExecutableActions", () => {
  const branches: BranchInfo[] = [
    {
      name: "main",
      commitSha: "abc123",
      updatedAt: "2024-01-01T00:00:00Z",
      isDefault: true,
      isProtected: true,
    },
    {
      name: "feature/foo",
      commitSha: "def456",
      updatedAt: "2024-02-02T00:00:00Z",
      isDefault: false,
      isProtected: false,
    },
  ];

  it("skips protected branches", () => {
    const result = computeExecutableActions({
      branches,
      selectedDeleteBranches: ["main", "feature/foo"],
      dryRun: false,
    });

    expect(result.deleteBranches).toEqual(["feature/foo"]);
    expect(result.skippedBranches).toEqual([
      {
        name: "main",
        reason: "protected",
      },
    ]);
  });

  it("marks dry-run as skipped", () => {
    const result = computeExecutableActions({
      branches,
      selectedDeleteBranches: ["feature/foo"],
      dryRun: true,
    });

    expect(result.deleteBranches).toEqual([]);
    expect(result.skippedBranches[0]).toEqual({
      name: "feature/foo",
      reason: "dry-run",
    });
  });
});
