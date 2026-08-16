import type { Hono } from 'hono';
import type { AuthBindings } from '../server/auth';

export type AppBindings = AuthBindings;
export type AppVariables = {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  mcpUserId: string;
};

export type App = Hono<{ Bindings: AppBindings; Variables: AppVariables }>;
