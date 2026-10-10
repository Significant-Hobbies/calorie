import type { Context, Hono } from 'hono';
import type { AuthBindings } from '../server/auth';

export type AppBindings = AuthBindings & {
  APP_HEALTH_STAGE_SAMPLE_RATE?: string;
};
export type AppVariables = {
  stageTimingCold: 0 | 1;
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  mcpUserId: string;
};

export type App = Hono<{ Bindings: AppBindings; Variables: AppVariables }>;
export type AppContext = Context<{ Bindings: AppBindings; Variables: AppVariables }>;
