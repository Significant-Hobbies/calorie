import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const worker = readFileSync(new URL('./worker.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../migrations/0006_mcp_read_tokens.sql', import.meta.url),
  'utf8'
);
const tokenSource = readFileSync(new URL('./server/read-tokens.ts', import.meta.url), 'utf8');
const mcpReads = worker.slice(
  worker.indexOf("app.get('/api/mcp/daily'"),
  worker.indexOf('app.notFound')
);

describe('Calorie MCP source boundary', () => {
  it('stores only a hash and revokes tokens within the signed-in owner', () => {
    expect(migration).toContain('token_hash TEXT NOT NULL UNIQUE');
    expect(migration).not.toMatch(/\btoken\s+TEXT/i);
    expect(worker).toContain('WHERE id = ? AND user_id = ? AND revoked_at IS NULL');
    expect(tokenSource).toContain('WHERE token_hash = ? AND revoked_at IS NULL');
  });

  it('registers only GET reads and excludes medication and weight at the source', () => {
    expect(mcpReads).not.toMatch(/app\.(post|put|patch|delete)\('\/api\/mcp/);
    expect(mcpReads).not.toMatch(/medication/i);
    expect(mcpReads).not.toMatch(/weight_entries|weightKg|weight_kg/);
    expect(mcpReads).toContain('readMcpTargets(c.env.DB, userId)');
    expect(worker).toContain(
      'SELECT manual_calorie_target, manual_calorie_min, manual_calorie_max,'
    );
    expect(worker).toContain('water_target_ml, fasting_threshold_hours');
    expect(mcpReads).toContain('user_id = ?');
  });

  it('bounds pages, daily rows, and history to one year', () => {
    expect(worker).toContain('Math.min(parsed, maximum)');
    expect(mcpReads).toContain('LIMIT 251');
    expect(mcpReads).toContain('LIMIT 1001');
    expect(mcpReads).toContain('totalDays > 366');
    expect(mcpReads).toContain(
      "provenance: day.recorded ? 'calculated-from-recorded-entries' : 'missing-day'"
    );
  });
});
