import { populateGlobal } from 'vitest/environments';
import type { Environment } from 'vitest/environments';

interface JsdomOptions {
  url?: string;
  html?: string;
}

// jsdom installs its own AbortSignal. Node fetch (undici) rejects that signal
// with "Expected signal to be an instance of AbortSignal" when React Router
// builds a Request. Keep Node's AbortController, fetch and Request.
const jsdomNodeWeb: Environment = {
  name: 'jsdom-node-web',
  transformMode: 'web',
  async setup(global, options) {
    const jsdomOptions = (options as { jsdom?: JsdomOptions } | undefined)?.jsdom ?? {};
    const nodeAbortController = global.AbortController;
    const nodeAbortSignal = global.AbortSignal;
    const nodeMessageChannel = global.MessageChannel;
    const nodeMessagePort = global.MessagePort;
    const nodeFetch = global.fetch.bind(global);
    const nodeRequest = global.Request;
    const nodeResponse = global.Response;
    const nodeHeaders = global.Headers;

    const { JSDOM } = await import('jsdom');
    const url = jsdomOptions.url ?? 'http://127.0.0.1:43110/';
    const dom = new JSDOM(jsdomOptions.html ?? '<!DOCTYPE html>', {
      url,
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    });
    const { keys, originals } = populateGlobal(global, dom.window, { bindFunctions: true });

    const fetchWithBase: typeof fetch = (input, init) => {
      const resolved =
        typeof input === 'string' && input.startsWith('/')
          ? new URL(input, dom.window.location.href).toString()
          : input;
      const href =
        typeof resolved === 'string'
          ? resolved
          : resolved instanceof URL
            ? resolved.href
            : resolved.url;
      if (!href.includes('/api/')) {
        return Promise.resolve(new nodeResponse(null, { status: 404, statusText: 'Not Found' }));
      }
      return nodeFetch(resolved, init);
    };

    global.AbortController = nodeAbortController;
    global.AbortSignal = nodeAbortSignal;
    global.MessageChannel = nodeMessageChannel;
    global.MessagePort = nodeMessagePort;
    global.fetch = fetchWithBase;
    global.Request = nodeRequest;
    global.Response = nodeResponse;
    global.Headers = nodeHeaders;
    dom.window.AbortController = nodeAbortController;
    dom.window.AbortSignal = nodeAbortSignal;
    dom.window.MessageChannel = nodeMessageChannel;
    dom.window.MessagePort = nodeMessagePort;
    dom.window.fetch = fetchWithBase;
    dom.window.Request = nodeRequest;
    dom.window.Response = nodeResponse;
    dom.window.Headers = nodeHeaders;

    return {
      teardown() {
        dom.window.close();
        keys.forEach((key) => {
          delete global[key];
        });
        originals.forEach((value, key) => {
          global[key] = value;
        });
      },
    };
  },
};

export default jsdomNodeWeb;
