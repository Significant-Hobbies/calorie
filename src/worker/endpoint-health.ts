import { honoMiddleware } from '@saas-maker/app-health/hono';
import { createAppHealthClient } from '@saas-maker/app-health';
import type { AppHealthClient, AppHealthClientOptions } from '@saas-maker/app-health';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from './types';

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

/** Return optional aggregate API monitoring backed by the official Hono adapter. */
export function createEndpointHealthMiddleware(
  createClient: ClientFactory = createAppHealthClient
): MiddlewareHandler<{ Bindings: AppBindings }> {
  let cachedKey: string | undefined;
  let cachedEnvironment: string | undefined;
  let cachedClient: AppHealthClient | null = null;

  return honoMiddleware<{ Bindings: AppBindings }>({
    client: (context) => {
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
    },
  });
}

export const endpointHealthMiddleware = createEndpointHealthMiddleware();
