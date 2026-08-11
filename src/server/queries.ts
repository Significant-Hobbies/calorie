export const DASHBOARD_FOODS_QUERY = `SELECT * FROM foods
  WHERE user_id = ? AND archived_at IS NULL
  ORDER BY last_used_at DESC, name ASC`;
