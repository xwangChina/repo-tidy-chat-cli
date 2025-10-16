interface LogFields {
  event: string;
  level?: "debug" | "info" | "warn" | "error";
  data?: Record<string, unknown>;
  error?: Error;
}

export function logStructured(fields: LogFields): void {
  const payload: Record<string, unknown> = {
    level: fields.level ?? "info",
    ts: new Date().toISOString(),
    event: fields.event,
  };

  if (fields.data) {
    payload.data = fields.data;
  }

  if (fields.error) {
    payload.error = {
      message: fields.error.message,
      stack: fields.error.stack,
    };
  }

  const text = JSON.stringify(payload);
  // eslint-disable-next-line no-console
  console.log(text);
}
