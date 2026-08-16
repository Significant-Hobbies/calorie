import { Apple, Plus } from 'lucide-react';
import type { Food } from '../../lib/types';

export function TodayLoggingLaunchpad({
  foods,
  quickFoods,
  pendingId,
  onOpenFoods,
  onOpenNewEntry,
  onQuickAdd,
}: {
  foods: Food[];
  quickFoods: Food[];
  pendingId: string | null;
  onOpenFoods: () => void;
  onOpenNewEntry: () => void;
  onQuickAdd: (food: Food) => void;
}) {
  return (
    <section className="quick-section logging-launchpad" aria-labelledby="quick-food-title">
      <div className="section-heading">
        <div>
          <p className="launchpad-kicker">Your journal</p>
          <h2 id="quick-food-title">Log food now</h2>
          <p>Start with a usual food, or add anything else.</p>
        </div>
        <div className="launchpad-actions">
          <button
            className="button button-primary button-compact"
            type="button"
            onClick={onOpenNewEntry}
          >
            <Plus size={18} aria-hidden="true" />
            Log food
          </button>
          <button className="text-button" type="button" onClick={onOpenFoods}>
            Manage
          </button>
        </div>
      </div>
      <div className="quick-foods">
        {quickFoods.slice(0, 4).map((food) => (
          <button
            key={food.id}
            className="quick-food"
            type="button"
            disabled={Boolean(pendingId)}
            onClick={() => onQuickAdd(food)}
          >
            <span className="food-glyph" aria-hidden="true">
              <Apple size={20} />
            </span>
            <span>
              <strong>{food.name}</strong>
              <small>
                {food.defaultAmount} {food.servingMode === 'per_100g' ? 'g' : food.unitLabel}
              </small>
            </span>
            <Plus size={18} aria-hidden="true" />
          </button>
        ))}
        {foods.length === 0 ? (
          <button className="quick-food quick-food-empty" type="button" onClick={onOpenFoods}>
            <span className="food-glyph">
              <Plus size={20} />
            </span>
            <span>
              <strong>Save your first food</strong>
              <small>Then it becomes a one-tap shortcut</small>
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
