import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api-url';

const httpsApi = 'https://api.example.com/v1';

describe('resolveApiUrl', () => {
  it('uses localhost when development omits the variable', () => {
    expect(resolveApiUrl(undefined, 'development')).toBe('http://127.0.0.1:43111');
    expect(resolveApiUrl(undefined, 'test')).toBe('http://127.0.0.1:43111');
  });

  it('uses a configured development url', () => {
    expect(resolveApiUrl('http://192.168.0.8:43111/', 'development')).toBe(
      'http://192.168.0.8:43111',
    );
  });

  it('accepts an explicit same-origin value in production', () => {
    expect(resolveApiUrl('', 'production')).toBe('');
    expect(resolveApiUrl('   ', 'production')).toBe('');
  });

  it('accepts an https url in production', () => {
    expect(resolveApiUrl(`${httpsApi}/`, 'production')).toBe(httpsApi);
  });

  it('fails when production omits the variable', () => {
    expect(() => resolveApiUrl(undefined, 'production')).toThrow(/VITE_API_URL/);
  });

  it('rejects localhost and loopback hosts in production', () => {
    expect(() => resolveApiUrl('http://localhost:43111', 'production')).toThrow(/localhost/);
    expect(() => resolveApiUrl('http://127.0.0.1:43111', 'production')).toThrow(/localhost/);
    expect(() => resolveApiUrl('https://localhost', 'production')).toThrow(/localhost/);
    expect(() => resolveApiUrl('https://127.0.0.1:43111', 'production')).toThrow(/localhost/);
  });

  it('rejects an external http url in production', () => {
    expect(() => resolveApiUrl('http://api.example.com', 'production')).toThrow(/https/);
  });
});
