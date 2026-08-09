import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./worker.ts', import.meta.url), 'utf8');

describe('private Worker data controls', () => {
  it('scopes correction mutations to the signed-in owner', () => {
    expect(source).toContain(
      'UPDATE water_entries SET amount_ml = ?, drank_at = ? WHERE id = ? AND user_id = ?'
    );
    expect(source).toContain(
      'UPDATE weight_entries SET weight_kg = ?, recorded_at = ? WHERE id = ? AND user_id = ?'
    );
    expect(source).toContain('DELETE FROM weight_entries WHERE id = ? AND user_id = ?');
  });

  it('atomically closes and creates a top-level cycle transition', () => {
    expect(source).toContain("'UPDATE goal_cycles SET end_on = ?, updated_at = ?");
    expect(source).toContain('cycleInsertStatement(c.env.DB');
    expect(source).toContain('await c.env.DB.batch(statements)');
  });

  it('exports every private journal table through mapped domain records', () => {
    for (const table of [
      'foods',
      'food_entries',
      'water_entries',
      'medications',
      'medication_check_ins',
      'weight_entries',
      'goal_cycles',
    ]) {
      expect(source).toContain(`FROM ${table} WHERE user_id = ?`);
    }
    expect(source).toContain('createJournalExport({');
    expect(source).not.toMatch(/createJournalExport\(\{[\s\S]*?(session|token|email|cache):/);
  });

  it('stores binary packaging snapshots while retaining legacy columns', () => {
    expect(source).toContain('food_kind, is_packaged, labels_json');
    expect(source).toContain('isPackaged: normalizeIsPackaged(row.is_packaged, row.food_kind)');
    expect(source).toContain("entry.isPackaged ? 'packaged' : 'prepared'");
  });
});
