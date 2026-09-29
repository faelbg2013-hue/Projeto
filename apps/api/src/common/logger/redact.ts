const SENSITIVE_KEY = /password|passwd|token|secret|authorization|cookie|database_url/i;
const URL_WITH_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^:\s/]+:[^@\s/]+@/gi;
const BEARER = /Bearer\s+\S+/gi;
const SENSITIVE_ASSIGNMENT =
  /((?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi;
const AUTHORIZATION_ASSIGNMENT = /((?:authorization)\s*[:=]\s*)(?:Bearer\s+\[REDACTED\]|\S+)/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(URL_WITH_CREDENTIALS, '$1[REDACTED]@')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(SENSITIVE_ASSIGNMENT, '$1[REDACTED]')
    .replace(AUTHORIZATION_ASSIGNMENT, '$1[REDACTED]');
}

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactValue(nested);
    }

    return output;
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  return value;
}
