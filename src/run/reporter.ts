import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Reporter, ActionPlan, RunSummary } from '../types.js';
import { buildHumanReport, buildJsonSummary } from './report.js';
import { OutputMode } from '../cli/options.js';
import { Logger } from '../types.js';

function shouldRenderTable(mode: OutputMode): boolean {
  return mode === 'table' || mode === 'both';
}

function shouldRenderJson(mode: OutputMode): boolean {
  return mode === 'json' || mode === 'both';
}

export interface ReporterOptions {
  outputMode: OutputMode;
  jsonPath?: string;
  logger: Logger;
  humanWriter?: (text: string) => void;
}

export class CliReporter implements Reporter {
  private readonly jsonPath: string;
  private readonly logger: Logger;
  private readonly outputMode: OutputMode;
  private readonly humanWriter: (text: string) => void;

  constructor(opts: ReporterOptions) {
    this.outputMode = opts.outputMode;
    this.jsonPath = opts.jsonPath ?? path.resolve('.repo-tidy/last_run.json');
    this.logger = opts.logger;
    this.humanWriter = opts.humanWriter ?? ((text) => console.log(text));
  }

  recordPlan(plan: ActionPlan): void {
    this.logger.debug('plan-recorded', { actionCount: plan.actions.length, dryRun: plan.dryRun });
  }

  recordResult(result: RunSummary['actions'][number]): void {
    this.logger.info('action-result', {
      action: result.action,
      status: result.status,
    });
  }

  async finalize(summary: RunSummary): Promise<void> {
    if (shouldRenderTable(this.outputMode)) {
      this.humanWriter(buildHumanReport(summary));
    }

    if (shouldRenderJson(this.outputMode)) {
      const dir = path.dirname(this.jsonPath);
      await mkdir(dir, { recursive: true });
      const payload = buildJsonSummary(summary);
      await writeFile(this.jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
      this.logger.info('json-summary-written', { path: this.jsonPath });
    }
  }
}
