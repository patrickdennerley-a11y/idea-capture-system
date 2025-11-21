import { supabase, getCurrentUser, isSupabaseConfigured } from './supabaseClient';

/**
 * Migration utility to move data from localStorage to Supabase
 */

const MIGRATION_STATUS_KEY = 'neural-migration-status';

const STORAGE_KEYS = {
  ideas: 'neural-ideas',
  logs: 'neural-logs',
  checklist: 'neural-checklist',
  reviews: 'neural-reviews',
  routines: 'neural-routines',
  reminderHistory: 'neural-reminder-history',
  timetable: 'neural-timetable'
};

const TABLE_NAMES = {
  ideas: 'ideas',
  logs: 'logs',
  checklist: 'checklist_items',
  reviews: 'reviews',
  routines: 'routines',
  reminderHistory: 'reminder_history',
  timetable: 'timetable'
};

/**
 * Check if migration has already been completed
 */
export const getMigrationStatus = () => {
  try {
    const status = localStorage.getItem(MIGRATION_STATUS_KEY);
    return status ? JSON.parse(status) : null;
  } catch (error) {
    console.error('Error reading migration status:', error);
    return null;
  }
};

/**
 * Update migration status
 */
const setMigrationStatus = (status) => {
  try {
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('Error saving migration status:', error);
  }
};

/**
 * Check if there's any data in localStorage to migrate
 */
export const hasLocalStorageData = () => {
  for (const key of Object.values(STORAGE_KEYS)) {
    const data = localStorage.getItem(key);
    if (data && data !== '[]' && data !== '{}' && data !== 'null') {
      return true;
    }
  }
  return false;
};

/**
 * Get data from localStorage
 */
const getLocalData = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return null;
  }
};

/**
 * Migrate ideas to Supabase
 */
const migrateIdeas = async (userId) => {
  const ideas = getLocalData(STORAGE_KEYS.ideas);
  if (!ideas || !Array.isArray(ideas) || ideas.length === 0) return { success: true, count: 0 };

  try {
    const dataToInsert = ideas.map(idea => ({
      id: idea.id,
      user_id: userId,
      content: idea.content,
      tags: idea.tags || [],
      timestamp: idea.timestamp,
      context: idea.context || null,
      classification_type: idea.classificationType || null,
      duration: idea.duration || null,
      recurrence: idea.recurrence || null,
      time_of_day: idea.timeOfDay || null,
      priority: idea.priority || null,
      created_at: idea.timestamp,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(TABLE_NAMES.ideas)
      .upsert(dataToInsert, { onConflict: 'id' });

    if (error) throw error;

    return { success: true, count: ideas.length };
  } catch (error) {
    console.error('Error migrating ideas:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Migrate logs to Supabase
 */
const migrateLogs = async (userId) => {
  const logs = getLocalData(STORAGE_KEYS.logs);
  if (!logs || !Array.isArray(logs) || logs.length === 0) return { success: true, count: 0 };

  try {
    const dataToInsert = logs.map(log => ({
      id: log.id,
      user_id: userId,
      timestamp: log.timestamp,
      activity: log.activity,
      duration: log.duration || null,
      energy: log.energy || null,
      motivation: log.motivation || null,
      notes: log.notes || null,
      created_at: log.timestamp,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(TABLE_NAMES.logs)
      .upsert(dataToInsert, { onConflict: 'id' });

    if (error) throw error;

    return { success: true, count: logs.length };
  } catch (error) {
    console.error('Error migrating logs:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Migrate checklist items to Supabase
 */
const migrateChecklist = async (userId) => {
  const checklist = getLocalData(STORAGE_KEYS.checklist);
  if (!checklist || !checklist.items || checklist.items.length === 0) return { success: true, count: 0 };

  try {
    const dataToInsert = checklist.items.map(item => ({
      id: item.id,
      user_id: userId,
      text: item.text,
      completed: item.completed || false,
      important: item.important || false,
      streak_count: checklist.streaks?.[item.id] || 0,
      last_reset: checklist.lastReset || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(TABLE_NAMES.checklist)
      .upsert(dataToInsert, { onConflict: 'id' });

    if (error) throw error;

    return { success: true, count: checklist.items.length };
  } catch (error) {
    console.error('Error migrating checklist:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Migrate reviews to Supabase
 */
const migrateReviews = async (userId) => {
  const reviews = getLocalData(STORAGE_KEYS.reviews);
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) return { success: true, count: 0 };

  try {
    const dataToInsert = reviews.map(review => ({
      id: review.id,
      user_id: userId,
      date: review.date,
      achievements: review.achievements || null,
      challenges: review.challenges || null,
      gratitude: review.gratitude || null,
      tomorrow_plan: review.tomorrowPlan || null,
      energy_level: review.energyLevel || null,
      mood: review.mood || null,
      created_at: review.date,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(TABLE_NAMES.reviews)
      .upsert(dataToInsert, { onConflict: 'id' });

    if (error) throw error;

    return { success: true, count: reviews.length };
  } catch (error) {
    console.error('Error migrating reviews:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Migrate routines to Supabase
 */
const migrateRoutines = async (userId) => {
  const routines = getLocalData(STORAGE_KEYS.routines);
  if (!routines || !Array.isArray(routines) || routines.length === 0) return { success: true, count: 0 };

  try {
    const dataToInsert = routines.map(routine => ({
      id: routine.id,
      user_id: userId,
      title: routine.title || routine.name || 'Untitled Routine',
      description: routine.description || null,
      time_of_day: routine.timeOfDay || null,
      duration: routine.duration || null,
      frequency: routine.frequency || null,
      tasks: routine.tasks || routine.steps || [],
      active: routine.active !== undefined ? routine.active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(TABLE_NAMES.routines)
      .upsert(dataToInsert, { onConflict: 'id' });

    if (error) throw error;

    return { success: true, count: routines.length };
  } catch (error) {
    console.error('Error migrating routines:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Main migration function
 */
export const migrateAllData = async () => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if migration already completed
    const migrationStatus = getMigrationStatus();
    if (migrationStatus?.completed) {
      console.log('Migration already completed on', migrationStatus.completedAt);
      return { success: true, alreadyMigrated: true, ...migrationStatus };
    }

    // Check if there's data to migrate
    if (!hasLocalStorageData()) {
      setMigrationStatus({
        completed: true,
        completedAt: new Date().toISOString(),
        noDataToMigrate: true
      });
      return { success: true, noDataToMigrate: true };
    }

    console.log('Starting data migration...');

    const results = {
      ideas: await migrateIdeas(user.id),
      logs: await migrateLogs(user.id),
      checklist: await migrateChecklist(user.id),
      reviews: await migrateReviews(user.id),
      routines: await migrateRoutines(user.id)
    };

    // Check if all migrations succeeded
    const allSuccess = Object.values(results).every(r => r.success);

    if (allSuccess) {
      const totalMigrated = Object.values(results).reduce((sum, r) => sum + (r.count || 0), 0);

      setMigrationStatus({
        completed: true,
        completedAt: new Date().toISOString(),
        results,
        totalItems: totalMigrated
      });

      console.log(`Migration completed! Migrated ${totalMigrated} items.`);

      return {
        success: true,
        results,
        totalItems: totalMigrated
      };
    } else {
      return {
        success: false,
        results,
        error: 'Some migrations failed'
      };
    }
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reset migration status (for testing or re-migration)
 */
export const resetMigrationStatus = () => {
  localStorage.removeItem(MIGRATION_STATUS_KEY);
};
