import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = [
  readFileSync(new URL('./worker.ts', import.meta.url), 'utf8'),
  ...readdirSync(new URL('./worker/', import.meta.url))
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => readFileSync(new URL(`./worker/${name}`, import.meta.url), 'utf8')),
].join('\n');

describe('private Worker data controls', () => {
  it('keeps the retired browser journal out of the public product surface', () => {
    expect(source).toContain("app.get(retiredPath, (c) => c.redirect('/', 308))");
    expect(source).not.toContain("c.redirect('/app/'");
  });

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
    const exportInput = source.match(/createJournalExport\(\{([\s\S]*?)\n\s*\}\)/)?.[1] ?? '';
    expect(exportInput).not.toMatch(/(session|token|email|cache):/);
  });

  it('stores binary packaging snapshots while retaining legacy columns', () => {
    expect(source).toContain('food_kind, is_packaged, labels_json');
    expect(source).toContain('isPackaged: normalizeIsPackaged(row.is_packaged, row.food_kind)');
    expect(source).toContain("entry.isPackaged ? 'packaged' : 'prepared'");
  });

  it('loads medicine history through a user-owned routine join', () => {
    expect(source).toContain(
      'JOIN medications m ON m.id = c.medication_id AND m.user_id = c.user_id'
    );
    expect(source).toContain(
      'WHERE c.user_id = ? AND c.taken_at >= ? AND c.taken_at < ? ORDER BY c.taken_at ASC'
    );
    expect(source).toContain('medicationName: row.medication_name');
  });
});
