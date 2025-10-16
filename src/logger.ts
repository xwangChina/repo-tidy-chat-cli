import { Logger } from './types.js';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LEVELS)[number];

function levelIndex(level: LogLevel): number {
  return LEVELS.indexOf(level);
}

function resolveLevel(level?: string): LogLevel {
  if (!level) {
    return 'info';
  }
  const normalized = level.toLowerCase();
  if (LEVELS.includes(normalized as LogLevel)) {
    return normalized as LogLevel;
  }
  return 'info';
}

export function createLogger(level?: string): Logger {
  const configuredLevel = resolveLevel(level);
  const configuredIndex = levelIndex(configuredLevel);

  const log = (targetLevel: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (levelIndex(targetLevel) < configuredIndex) {
      return;
    }
    const payload = {
      level: targetLevel,
      message,
      time: new Date().toISOString(),
      ...(meta ?? {}),
    };
    const line = JSON.stringify(payload);
    if (targetLevel === 'warn' || targetLevel === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
  };
}
