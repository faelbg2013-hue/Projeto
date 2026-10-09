import { redactSensitiveText } from '../common/logger/redact';

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

export function sanitizeEvidenceText(value: string): string {
  return redactSensitiveText(value).replace(JWT, '[REDACTED]');
}
