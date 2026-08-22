import { Hono } from 'hono';
import { handleAgentEdge } from './agent-edge.mjs';
import { registerAccountRoutes } from './worker/account';
import { registerAuthRoutes, registerSessionMiddleware } from './worker/auth';
import { SECURITY_HEADERS } from './worker/http';
import { registerJournalRoutes } from './worker/journal';
import { registerMcpRoutes } from './worker/mcp';
import { registerPersonalPlatformRoutes } from './worker/personal-platform';
import { registerReadRoutes } from './worker/reads';
import type { AppBindings, AppVariables } from './worker/types';

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use('*', async (c, next) => {
  const agentResponse = handleAgentEdge(c.req.raw);
  if (agentResponse) return agentResponse;
  await next();
});

for (const retiredPath of ['/app', '/app/', '/app/*']) {
  app.get(retiredPath, (c) => c.redirect('/', 308));
}

app.use('*', async (c, next) => {
  await next();
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith('/api/') && !path.startsWith('/v1/')) return;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
  // Read-only GETs set their own Cache-Control via conditionalJson; everything
  // else stays no-store.
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

registerAuthRoutes(app);
registerSessionMiddleware(app);
registerAccountRoutes(app);
registerJournalRoutes(app);
registerReadRoutes(app);
registerMcpRoutes(app);
registerPersonalPlatformRoutes(app);

app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/')) {
    return c.json(
      { error: { code: 'not_found', message: `Unknown API path: ${path}`, path } },
      404
    );
  }
  // For non-API paths, fall through to static assets so the landing page,
  // marketing pages, and other static files are served correctly.
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: 'request_failed',
      path: new URL(c.req.url).pathname,
      message: error instanceof Error ? error.message : String(error),
    })
  );
  return c.json(
    { code: 'SERVER_ERROR', message: 'Calorie could not finish that request. Try again.' },
    500
  );
});

export default app;
