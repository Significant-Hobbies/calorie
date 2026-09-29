import { honoMiddleware } from '@saas-maker/app-health/hono';
import { createAppHealthClient } from '@saas-maker/app-health';
import type { AppHealthClient, AppHealthClientOptions } from '@saas-maker/app-health';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from './types';

const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

type ClientFactory = (options: AppHealthClientOptions) => AppHealthClient;

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
