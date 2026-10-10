import { honoMiddleware } from '@saas-maker/app-health/hono';
import { createAppHealthClient } from '@saas-maker/app-health';
import type { AppHealthClient, AppHealthClientOptions } from '@saas-maker/app-health';
import type { Context, MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';
import type { AppBindings, AppVariables } from './types';

type HealthEnv = { Bindings: AppBindings; Variables: AppVariables };
type ClientResolver = (context: Context<HealthEnv>) => AppHealthClient | null;

const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';
const DELIVERY_EVENT = 'app_health_ingest_delivery';

type ClientFactory = (options: AppHealthClientOptions) => AppHealthClient;

type DeliveryCounts = { accepted: number; duplicates: number };

function safeDeliveryCounts(value: unknown): DeliveryCounts | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  const { accepted, duplicates } = payload;
  if (
    typeof accepted !== 'number' ||
    !Number.isSafeInteger(accepted) ||
    accepted < 0 ||
    typeof duplicates !== 'number' ||
    !Number.isSafeInteger(duplicates) ||
    duplicates < 0
  ) {
    return null;
  }

  return { accepted, duplicates };
}

function deliveryReceiptFetch(): NonNullable<AppHealthClientOptions['fetch']> {
  return async (input, init) => {
    const response = await fetch(input, init);
    const receipt = {
      event: DELIVERY_EVENT,
      observedAt: new Date().toISOString(),
      status: response.status,
    };

    if (response.status === 202) {
      try {
        const counts = safeDeliveryCounts(await response.clone().json());
        emitDeliveryReceipt(counts ? { ...receipt, ...counts } : receipt);
      } catch {
        emitDeliveryReceipt(receipt);
      }
    } else {
      emitDeliveryReceipt(receipt);
    }

    return response;
  };
}

function emitDeliveryReceipt(receipt: {
  event: string;
  observedAt: string;
  status: number;
  accepted?: number;
  duplicates?: number;
}): void {
  try {
    console.info(JSON.stringify(receipt));
  } catch {
    // Observability must not affect application or collector responses.
  }
}

function createClientResolver(createClient: ClientFactory): ClientResolver {
  let cachedKey: string | undefined;
  let cachedEnvironment: string | undefined;
  let cachedClient: AppHealthClient | null = null;

  return (context) => {
    const key = context.env.APP_HEALTH_INGEST_KEY?.trim();
    if (!key) {
      cachedKey = undefined;
      cachedEnvironment = undefined;
      cachedClient = null;
      return null;
    }

    const environment = context.env.APP_HEALTH_ENVIRONMENT?.trim() || 'production';
    if (cachedClient && cachedKey === key && cachedEnvironment === environment) {
      return cachedClient;
    }

    try {
      cachedClient = createClient({
        key,
        environment,
        endpoint: INGEST_ENDPOINT,
        runtime: 'worker',
        maxQueueSize: 100,
        maxBatchSize: 20,
        requestTimeoutMs: 1_000,
        maxRetries: 1,
        disableTimer: true,
        fetch: deliveryReceiptFetch(),
      });
      cachedKey = key;
      cachedEnvironment = environment;
      return cachedClient;
    } catch {
      cachedClient = null;
      cachedKey = undefined;
      cachedEnvironment = undefined;
      return null;
    }
  };
}

/** Return optional aggregate API monitoring backed by the official Hono adapter. */
export function createEndpointHealthMiddleware(
  createClient: ClientFactory = createAppHealthClient
): MiddlewareHandler<HealthEnv> {
  return honoMiddleware<HealthEnv>({ client: createClientResolver(createClient) });
}

function stageSampleRate(value: string | undefined): number {
  const rate = value?.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1;
}

function safeStageRoute(route: string): boolean {
  return (
    route.startsWith('/') &&
    route.length <= 120 &&
    !route
      .split('/')
      .some((segment) =>
        /^(?:[0-9]+|[a-f0-9]{16,}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(
          segment
        )
      )
  );
}

export function createHealthMiddlewares(createClient: ClientFactory = createAppHealthClient) {
  const resolveClient = createClientResolver(createClient);
  let firstRequest = true;
  // Mounted before agent-edge handling so a marketing request also warms the isolate.
  const isolateColdMiddleware: MiddlewareHandler<HealthEnv> = async (context, next) => {
    context.set('stageTimingCold', firstRequest ? 1 : 0);
    firstRequest = false;
    await next();
  };
  const stageTimingMiddleware: MiddlewareHandler<HealthEnv> = async (context, next) => {
    const start = performance.now();
    await next();
    try {
      if (!context.env.APP_HEALTH_INGEST_KEY?.trim()) return;
      if (Math.random() >= stageSampleRate(context.env.APP_HEALTH_STAGE_SAMPLE_RATE)) return;
      const route = routePath(context, -1);
      if (!safeStageRoute(route)) return;
      const client = resolveClient(context);
      if (!client) return;
      const colo = context.req.raw.cf?.colo;
      client.log('api.stage_timing', {
        level: 'debug',
        props: {
          route,
          status: context.res.status,
          total_ms: Math.min(600000, Math.max(0, Math.round(performance.now() - start))),
          edge_cache: 'NONE',
          inner_cache: 'NONE',
          colo: typeof colo === 'string' && /^[A-Za-z0-9]{1,8}$/.test(colo) ? colo : 'unknown',
          cold: context.get('stageTimingCold'),
        },
      });
      const delivery = client.flush().catch(() => {});
      try {
        context.executionCtx.waitUntil(delivery);
      } catch {
        void delivery;
      }
    } catch {
      // Optional telemetry must never change application responses.
    }
  };
  return {
    isolateColdMiddleware,
    endpointHealthMiddleware: honoMiddleware<HealthEnv>({ client: resolveClient }),
    stageTimingMiddleware,
  };
}

export const { isolateColdMiddleware, endpointHealthMiddleware, stageTimingMiddleware } =
  createHealthMiddlewares();
