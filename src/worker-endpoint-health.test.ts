import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppHealthClient, AppHealthClientOptions, EventInput } from '@saas-maker/app-health';
import { createEndpointHealthMiddleware } from './worker/endpoint-health';
import type { AppBindings } from './worker/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function clientFactory() {
  const events: EventInput[] = [];
  const flush = vi.fn(async () => {});
  const client = {
    record: (event: EventInput) => events.push(event),
    log: vi.fn(),
    flush,
    close: vi.fn(async () => {}),
    diagnostics: vi.fn(() => ({
      queued: 0,
      sentBatches: 0,
      sentEvents: 0,
      failedBatches: 0,
      retriedBatches: 0,
      droppedInvalid: 0,
      droppedOverflow: 0,
      droppedDelivery: 0,
      lastSendError: null,
    })),
  } satisfies AppHealthClient;
  const createClient = vi.fn((_options: AppHealthClientOptions) => client);
  return { client, createClient, events, flush };
}

function testApp(middleware: ReturnType<typeof createEndpointHealthMiddleware>) {
  const app = new Hono<{ Bindings: AppBindings }>();
  app.use('/api/*', middleware);
  app.use('/v1/personal/*', middleware);
  app.get('/api/app/foods/:id', (context) => context.json({ ok: true }, 201));
  app.post('/v1/personal/actions/log_food', (context) => context.json({ ok: true }, 202));
  app.get('/privacy', (context) => context.text('privacy'));
  return app;
}

async function configuredDeliveryFetch(
  createClient: ReturnType<typeof clientFactory>['createClient']
) {
  const app = testApp(createEndpointHealthMiddleware(createClient));
  const appResponse = await app.request('/api/app/foods/test-id', undefined, {
    APP_HEALTH_INGEST_KEY: 'synthetic-test-key',
  } as AppBindings);

  const fetch = createClient.mock.calls[0]?.[0].fetch;
  if (!fetch) throw new Error('expected App Health client fetch hook');
  return { appResponse, fetch };
}

describe('optional privacy-bounded endpoint health', () => {
  it('does not initialize a client without the optional ingestion key', async () => {
    const { createClient, events } = clientFactory();
    const app = testApp(createEndpointHealthMiddleware(createClient));

    const response = await app.request('/api/app/foods/private-id?food=personal', undefined, {});

    expect(response.status).toBe(201);
    expect(createClient).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('records normalized service route templates without concrete values', async () => {
    const { createClient, events } = clientFactory();
    const app = testApp(createEndpointHealthMiddleware(createClient));
    const env = {
      APP_HEALTH_INGEST_KEY: 'synthetic-test-key',
      APP_HEALTH_ENVIRONMENT: 'staging',
    } as AppBindings;

    const response = await app.request(
      'https://calorie.example/api/app/foods/private-food-id?food=private-name&token=private-token',
      { headers: { cookie: 'session=private', authorization: 'Bearer private' } },
      env
    );

    expect(response.status).toBe(201);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      method: 'GET',
      route: '/api/app/foods/:id',
      status_code: 201,
    });
    expect(JSON.stringify(events)).not.toContain('private-food-id');
    expect(JSON.stringify(events)).not.toContain('private-name');
    expect(JSON.stringify(events)).not.toContain('private-token');
    expect(JSON.stringify(events)).not.toContain('Bearer');
    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient.mock.calls[0]?.[0]).toMatchObject({
      key: 'synthetic-test-key',
      environment: 'staging',
      endpoint: 'https://ingest.sassmaker.com/v1/ingest',
      runtime: 'worker',
      maxQueueSize: 100,
      maxBatchSize: 20,
      requestTimeoutMs: 1_000,
      maxRetries: 1,
      disableTimer: true,
    });
    expect(createClient.mock.calls[0]?.[0].fetch).toBeTypeOf('function');
  });

  it('records only a real 202 status and validated acceptance counts', async () => {
    const collectorResponse = new Response(
      JSON.stringify({ accepted: 2, duplicates: 1, private: 'synthetic-response-secret' }),
      { status: 202 }
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => collectorResponse)
    );
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createClient } = clientFactory();
    const { appResponse, fetch } = await configuredDeliveryFetch(createClient);
    expect(appResponse.status).toBe(201);

    const response = await fetch('https://ingest.example/v1/ingest', {
      method: 'POST',
      headers: { authorization: 'Bearer synthetic-private-key' },
      body: JSON.stringify({ events: ['synthetic-private-payload'] }),
    });

    expect(response).toBe(collectorResponse);
    expect(await response.json()).toEqual({
      accepted: 2,
      duplicates: 1,
      private: 'synthetic-response-secret',
    });
    expect(log).toHaveBeenCalledOnce();
    const receipt = JSON.parse(log.mock.calls[0]?.[0] ?? 'null') as {
      event: string;
      observedAt: string;
      status: number;
      accepted: number;
      duplicates: number;
    };
    expect(receipt).toEqual({
      event: 'app_health_ingest_delivery',
      observedAt: expect.any(String),
      status: 202,
      accepted: 2,
      duplicates: 1,
    });
    expect(Number.isNaN(Date.parse(receipt.observedAt))).toBe(false);
    expect(log.mock.calls[0]?.[0]).not.toContain('synthetic-private-key');
    expect(log.mock.calls[0]?.[0]).not.toContain('synthetic-private-payload');
    expect(log.mock.calls[0]?.[0]).not.toContain('synthetic-response-secret');
  });

  it('records status only when a 202 body cannot supply safe integer counts', async () => {
    const collectorResponse = new Response(JSON.stringify({ accepted: '2', duplicates: -1 }), {
      status: 202,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => collectorResponse)
    );
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createClient } = clientFactory();
    const { appResponse, fetch } = await configuredDeliveryFetch(createClient);
    expect(appResponse.status).toBe(201);

    const response = await fetch('https://ingest.example/v1/ingest', { method: 'POST' });

    expect(response).toBe(collectorResponse);
    expect(await response.json()).toEqual({ accepted: '2', duplicates: -1 });
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0]?.[0] ?? 'null')).toMatchObject({
      event: 'app_health_ingest_delivery',
      status: 202,
    });
    expect(log.mock.calls[0]?.[0]).not.toContain('accepted');
    expect(log.mock.calls[0]?.[0]).not.toContain('duplicates');
  });

  it('records status only for an unreadable collector response without consuming it', async () => {
    const collectorResponse = new Response('not-json', { status: 202 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => collectorResponse)
    );
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createClient } = clientFactory();
    const { appResponse, fetch } = await configuredDeliveryFetch(createClient);
    expect(appResponse.status).toBe(201);

    const response = await fetch('https://ingest.example/v1/ingest', { method: 'POST' });

    expect(response).toBe(collectorResponse);
    expect(await response.text()).toBe('not-json');
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0]?.[0] ?? 'null')).toMatchObject({
      event: 'app_health_ingest_delivery',
      status: 202,
    });
    expect(log.mock.calls[0]?.[0]).not.toContain('accepted');
    expect(log.mock.calls[0]?.[0]).not.toContain('duplicates');
  });

  it('records non-202 failures by status only and preserves the collector response', async () => {
    const collectorResponse = new Response(JSON.stringify({ accepted: 1, duplicates: 0 }), {
      status: 503,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => collectorResponse)
    );
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { createClient } = clientFactory();
    const { appResponse, fetch } = await configuredDeliveryFetch(createClient);
    expect(appResponse.status).toBe(201);

    const response = await fetch('https://ingest.example/v1/ingest', { method: 'POST' });

    expect(response).toBe(collectorResponse);
    expect(await response.json()).toEqual({ accepted: 1, duplicates: 0 });
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0]?.[0] ?? 'null')).toEqual({
      event: 'app_health_ingest_delivery',
      observedAt: expect.any(String),
      status: 503,
    });
  });

  it('preserves collector responses if receipt logging throws', async () => {
    const collectorResponse = new Response(JSON.stringify({ accepted: 1, duplicates: 0 }), {
      status: 202,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => collectorResponse)
    );
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('synthetic logger failure');
    });
    const { createClient } = clientFactory();
    const { appResponse, fetch } = await configuredDeliveryFetch(createClient);
    expect(appResponse.status).toBe(201);

    const response = await fetch('https://ingest.example/v1/ingest', { method: 'POST' });

    expect(response).toBe(collectorResponse);
    expect(await response.json()).toEqual({ accepted: 1, duplicates: 0 });
  });

  it('monitors personal service routes but skips marketing routes', async () => {
    const { createClient, events } = clientFactory();
    const app = testApp(createEndpointHealthMiddleware(createClient));
    const env = { APP_HEALTH_INGEST_KEY: 'synthetic-test-key' } as AppBindings;

    await app.request('/v1/personal/actions/log_food?title=private', { method: 'POST' }, env);
    const countAfterApi = events.length;
    const marketingResponse = await app.request('/privacy', undefined, env);

    expect(countAfterApi).toBe(1);
    expect(events[0]).toMatchObject({
      method: 'POST',
      route: '/v1/personal/actions/log_food',
      status_code: 202,
    });
    expect(marketingResponse.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(createClient).toHaveBeenCalledOnce();
  });

  it('preserves the application response when the SDK is unavailable', async () => {
    const { client, createClient } = clientFactory();
    const middleware = createEndpointHealthMiddleware(() => {
      throw new Error('synthetic initialization failure');
    });
    const app = testApp(middleware);

    const response = await app.request('/api/app/foods/123', undefined, {
      APP_HEALTH_INGEST_KEY: 'synthetic-test-key',
    } as AppBindings);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(createClient).not.toHaveBeenCalled();
    expect(client.flush).not.toHaveBeenCalled();
  });
});
