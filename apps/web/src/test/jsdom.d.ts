declare module 'jsdom' {
  interface DOMWindow extends Window {
    close(): void;
    AbortController: typeof AbortController;
    AbortSignal: typeof AbortSignal;
    fetch: typeof fetch;
    Request: typeof Request;
    Response: typeof Response;
    Headers: typeof Headers;
  }

  export class JSDOM {
    constructor(
      html?: string,
      options?: {
        url?: string;
        pretendToBeVisual?: boolean;
        runScripts?: 'dangerously' | 'outside-only';
      },
    );
    window: DOMWindow;
  }
}
