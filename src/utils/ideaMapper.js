/**
 * Utility functions to map between database snake_case and JavaScript camelCase
 * for the ideas table in Supabase
 */

/**
 * Convert database row (snake_case) to JavaScript object (camelCase)
 * @param {Object} dbIdea - Idea from Supabase database
 * @returns {Object} - JavaScript idea object
 */
export function dbToJs(dbIdea) {
  if (!dbIdea) return null;

  return {
    id: dbIdea.id,
    content: dbIdea.content,
    tags: dbIdea.tags || [],
    context: dbIdea.context || '',
    dueDate: dbIdea.due_date || null,
    classificationType: dbIdea.classification_type || 'general',
    duration: dbIdea.duration || null,
    recurrence: dbIdea.recurrence || 'none',
    timeOfDay: dbIdea.time_of_day || null,
    priority: dbIdea.priority || 'medium',
    autoClassified: dbIdea.auto_classified || false,
    source: dbIdea.source || 'web',
    timestamp: dbIdea.created_at,
    lastModified: dbIdea.last_modified,
  };
}

/**
 * Convert JavaScript object (camelCase) to database format (snake_case)
 * @param {Object} jsIdea - JavaScript idea object
 * @param {string} userId - Current user's ID
 * @returns {Object} - Database-ready idea object
 */
export function jsToDb(jsIdea, userId) {
  if (!jsIdea) return null;

  const dbIdea = {
    user_id: userId,
    content: jsIdea.content,
    tags: jsIdea.tags || [],
    context: jsIdea.context || null,
    due_date: jsIdea.dueDate || null,
    classification_type: jsIdea.classificationType || 'general',
    duration: jsIdea.duration || null,
    recurrence: jsIdea.recurrence || 'none',
    time_of_day: jsIdea.timeOfDay || null,
    priority: jsIdea.priority || 'medium',
    auto_classified: jsIdea.autoClassified || false,
    source: jsIdea.source || 'web',
  };

  // Only include id if it exists (for updates)
  if (jsIdea.id) {
    dbIdea.id = jsIdea.id;
  }

  return dbIdea;
}

/**
 * Convert multiple database rows to JavaScript objects
 * @param {Array} dbIdeas - Array of ideas from Supabase
 * @returns {Array} - Array of JavaScript idea objects
 */
export function dbArrayToJs(dbIdeas) {
  if (!Array.isArray(dbIdeas)) return [];
  return dbIdeas.map(dbToJs);
}
