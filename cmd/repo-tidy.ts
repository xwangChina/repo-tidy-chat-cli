#!/usr/bin/env node
import { parseCliArgs } from '../src/cli/options.js';
import { createLogger } from '../src/logger.js';
import { createUi } from '../src/ui/menus.js';
import { runRepoTidyWorkflow } from '../src/workflow/stateMachine.js';
import { CliReporter } from '../src/run/reporter.js';
import { OpenAIRepoTidyAgent } from '../src/agent/agent.js';
import { printPatScopeGuidance } from '../src/mcp/github.js';

async function main() {
  try {
    const cli = parseCliArgs(process.argv);

    const envDryRun = (process.env.REPO_TIDY_DRY_RUN ?? '').toLowerCase() === 'true';
    const envAssumeYes = (process.env.REPO_TIDY_ASSUME_YES ?? '').toLowerCase() === 'true';

    const dryRun = cli.dryRun || envDryRun;
    const assumeYes = cli.assumeYes || envAssumeYes || dryRun;

    const logger = createLogger(process.env.LOG_LEVEL);

    const interactive = Boolean(
      process.stdout.isTTY &&
        process.stdin.isTTY &&
        cli.preselected.closePrNumbers.length === 0 &&
        cli.preselected.deleteBranches.length === 0
    );

    const ui = createUi(logger, interactive);
    const reporter = new CliReporter({ outputMode: cli.outputMode, logger });

    printPatScopeGuidance();

    const agent = new OpenAIRepoTidyAgent({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      mcpUrl: cli.mcpUrl,
      pat: process.env.GITHUB_MCP_PAT,
      logger,
    });

    const summary = await runRepoTidyWorkflow(
      {
        repo: cli.repo,
        dryRun,
        assumeYes,
        preselected: cli.preselected,
        outputMode: cli.outputMode,
      },
      {
        agent,
        ui,
        reporter,
        logger,
        now: () => new Date(),
      }
    );

    if (typeof ui.dispose === 'function') {
      await Promise.resolve(ui.dispose());
    }

    if (summary.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({ level: 'error', message: 'repo-tidy failed', time: new Date().toISOString(), error: message })
    );
    process.exitCode = 1;
  }
}

main();
