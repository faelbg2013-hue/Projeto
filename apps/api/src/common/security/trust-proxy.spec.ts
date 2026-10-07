import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { applyTrustProxy } from './trust-proxy';

const forwardedClient = '203.0.113.10';

function ipApp(trustProxy: false | number) {
  const app = express();
  applyTrustProxy(app, trustProxy);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe('trust proxy', () => {
  it('ignores a forwarded address when proxy trust is disabled', async () => {
    const direct = await request(ipApp(false)).get('/ip');
    const forwarded = await request(ipApp(false)).get('/ip').set('X-Forwarded-For', forwardedClient);

    expect(forwarded.body.ip).toBe(direct.body.ip);
    expect(forwarded.body.ip).not.toBe(forwardedClient);
  });

  it('uses the address resolved by Express when one proxy is trusted', async () => {
    const response = await request(ipApp(1)).get('/ip').set('X-Forwarded-For', forwardedClient);

    expect(response.body.ip).toBe(forwardedClient);
  });

  it('treats zero trusted proxies as disabled', async () => {
    const direct = await request(ipApp(0)).get('/ip');
    const forwarded = await request(ipApp(0)).get('/ip').set('X-Forwarded-For', forwardedClient);

    expect(forwarded.body.ip).toBe(direct.body.ip);
    expect(forwarded.body.ip).not.toBe(forwardedClient);
  });
});
