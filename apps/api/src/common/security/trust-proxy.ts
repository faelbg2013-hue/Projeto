import type { Express } from 'express';

export function applyTrustProxy(app: Express, trustProxy: false | number): void {
  app.set('trust proxy', trustProxy);
}
