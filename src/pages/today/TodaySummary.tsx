import { Apple, Check, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MacroCompletion } from '../../lib/macro-completion';
import { formatCalorieAdjustmentRange } from '../../lib/recommendations';
import type { Dashboard, Food } from '../../lib/types';

type NutrientItem = {
  label: string;
  value: number;
  unit: string;
  target: number | null;
  icon: LucideIcon;
  className: string;
};

export function TodaySummary({
  dashboard,
  target,
  calorieProgress,
  nutrients,
  onOpenSettings,
}: {
  dashboard: Dashboard;
  target: number | null;
  calorieProgress: number;
  nutrients: NutrientItem[];
  onOpenSettings: () => void;
}) {
  return (
    <section className="daily-summary" aria-labelledby="daily-summary-title">
      <div className="summary-topline">
        <div>
          <span id="daily-summary-title">Daily range</span>
          <strong>
            {target
              ? `${dashboard.target.calorieRange?.[0].toLocaleString()}–${dashboard.target.calorieRange?.[1].toLocaleString()} kcal`
              : 'Targets not set'}
          </strong>
          {!target ? (
            <button className="summary-target-button" type="button" onClick={onOpenSettings}>
              Set your targets
            </button>
          ) : null}
          {dashboard.target.maintenanceCalories ? (
            <small className="goal-context">
              {dashboard.target.maintenanceCalories.toLocaleString()} maintenance{' '}
              {formatCalorieAdjustmentRange(dashboard.target.goalAdjustmentRangeCalories)} for your
              goal
            </small>
          ) : null}
        </div>
        <div className="summary-topline-right">
          <span>{target ? `${Math.round(calorieProgress)}%` : '—'}</span>
        </div>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${calorieProgress}%` }} />
      </div>
      <div className="nutrient-strip">
        {nutrients.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={item.className}>
              <Icon size={18} aria-hidden="true" />
              <strong>
                {item.value}
                <small>{item.unit}</small>
              </strong>
              <span>
                {item.label}
                {item.target ? ` · ${item.target}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TodayRemaining({
  completion,
  pendingId,
  onQuickAdd,
}: {
  completion: MacroCompletion | null;
  pendingId: string | null;
  onQuickAdd: (food: Food) => void;
}) {
  if (!completion) return null;

  return (
    <section className="remaining-panel" aria-labelledby="remaining-title">
      <div className="section-heading">
        <div>
          <h2 id="remaining-title">Remaining today</h2>
          <p>
            {completion.complete
              ? 'You’ve hit your tracked targets.'
              : completion.leadingMacro === 'protein'
                ? 'Protein is your widest gap.'
                : 'Fibre is your widest gap.'}
          </p>
        </div>
      </div>
      {completion.complete ? (
        <div className="remaining-complete">
          <Check aria-hidden="true" />
          <span>Targets met — enjoy the rest of your day.</span>
        </div>
      ) : (
        <>
          <div className="remaining-totals">
            <div>
              <strong>{completion.remainingCalories.toLocaleString()}</strong>
              <small>kcal remaining</small>
            </div>
            <div>
              <strong>{completion.remainingProteinG.toLocaleString()}</strong>
              <small>g protein left</small>
            </div>
            <div>
              <strong>{completion.remainingFibreG.toLocaleString()}</strong>
              <small>g fibre left</small>
            </div>
          </div>
          {completion.suggestions.length ? (
            <div className="remaining-suggestions">
              <p className="remaining-suggestions-label">One serving covers the most:</p>
              {completion.suggestions.map((item) => (
                <button
                  key={item.food.id}
                  className="quick-food"
                  type="button"
                  disabled={Boolean(pendingId)}
                  onClick={() => onQuickAdd(item.food)}
                >
                  <span className="food-glyph" aria-hidden="true">
                    <Apple size={20} />
                  </span>
                  <span>
                    <strong>{item.food.name}</strong>
                    <small>
                      {item.calories} kcal · {item.proteinG}g protein · {item.fibreG}g fibre
                    </small>
                  </span>
                  <Plus size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="remaining-no-foods">
              Save a few foods to get one-tap suggestions that fill the gap.
            </p>
          )}
        </>
      )}
    </section>
  );
}
