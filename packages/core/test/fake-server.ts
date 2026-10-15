import type { FetchFn } from '../src/client.js';

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body?: Uint8Array;
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>;

/**
 * In-memory stand-in for the ContextQA API. Routes are keyed by
 * "METHOD /path"; a route with several handlers serves them in order and
 * repeats the last one.
 */
export class FakeServer {
  readonly requests: RecordedRequest[] = [];
  private readonly routes = new Map<string, Handler[]>();

  on(method: string, path: string, ...handlers: Handler[]): this {
    this.routes.set(`${method} ${path}`, handlers);
    return this;
  }

  readonly fetch: FetchFn = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : undefined;
    const request: RecordedRequest = { method, url, headers: new Headers(init?.headers), body };
    this.requests.push(request);

    const key = `${method} ${url.host === 'uploads.example.com' ? 'upload' : url.pathname}`;
    const handlers = this.routes.get(key);
    if (!handlers || handlers.length === 0) throw new Error(`FakeServer: no route for ${key}`);
    const handler = handlers.length > 1 ? handlers.shift() : handlers[0];
    return handler!(request);
  };

  calls(path: string): RecordedRequest[] {
    return this.requests.filter((r) => r.url.pathname === path);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function text(body: string, status: number): Response {
  return new Response(body, { status });
}

export function results(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'STATUS_COMPLETED',
    result: 'SUCCESS',
    duration: 4200,
    totalCount: 2,
    passedCount: 2,
    failedCount: 0,
    abortedCount: 0,
    stoppedCount: 0,
    notExecutedCount: 0,
    reportFileUrl: 'https://app.example.com/td/runs/77',
    ...overrides,
  };
}

/** A clock that only moves when the code under test sleeps. */
export function fakeTime(): { now: () => number; sleep: (ms: number) => Promise<void>; slept: number[] } {
  let current = 0;
  const slept: number[] = [];
  return {
    now: () => current,
    sleep: async (ms) => {
      slept.push(ms);
      current += ms;
    },
    slept,
  };
}

export function recordingReporter(): { info: (m: string) => void; warn: (m: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { info: (m) => lines.push(m), warn: (m) => lines.push(`WARN ${m}`), lines };
}
