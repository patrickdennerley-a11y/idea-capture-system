/**
 * LEARNING SERVICE
 * 
 * Handles all data operations for the learning module:
 * - Question history persistence
 * - Mastery tracking and adaptive difficulty
 * - Score persistence
 * 
 * Supports both:
 * - Authenticated users (Supabase)
 * - Guest users (localStorage fallback)
 */

import { supabase } from '../supabaseClient';

// ============================================
// CONSTANTS
// ============================================

const ROLLING_WINDOW_SIZE = 10;
const BUMP_UP_THRESHOLD = 0.80;
const BUMP_DOWN_THRESHOLD = 0.40;
const MIN_QUESTIONS_TO_JUDGE = 5;
const STREAK_FARMING_THRESHOLD = 15;
const STREAK_FARMING_ACCURACY = 0.85;
const OSCILLATION_LIMIT = 3;

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme'];

// localStorage keys for guest mode
const GUEST_HISTORY_KEY = 'learning-question-history';
const GUEST_SCORES_KEY = 'learning-scores';
const GUEST_MASTERY_KEY = 'learning-mastery';

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Get current user and determine if guest mode
 * @returns {Object} { userId, isGuest }
 */
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check for guest mode
  const isGuestMode = localStorage.getItem('neural-guest-mode') === 'true';
  
  if (isGuestMode || !user) {
    return { userId: 'guest', isGuest: true };
  }
  
  return { userId: user.id, isGuest: false };
};

// ============================================
// DIFFICULTY HELPERS
// ============================================

const getNextDifficultyUp = (current) => {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  return idx < DIFFICULTY_ORDER.length - 1 ? DIFFICULTY_ORDER[idx + 1] : current;
};

const getNextDifficultyDown = (current) => {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  return idx > 0 ? DIFFICULTY_ORDER[idx - 1] : current;
};

const calculateRollingAccuracy = (lastResults) => {
  if (!lastResults || lastResults.length === 0) return 0.5;
  const totalScore = lastResults.reduce((sum, r) => sum + (r.score || 0), 0);
  return totalScore / lastResults.length;
};

// ============================================
// GUEST MODE HELPERS
// ============================================

const getGuestHistory = () => {
  try {
    const stored = localStorage.getItem(GUEST_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveGuestHistory = (history) => {
  try {
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving guest history:', error);
  }
};

const getGuestScores = () => {
  try {
    const stored = localStorage.getItem(GUEST_SCORES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveGuestScores = (scores) => {
  try {
    localStorage.setItem(GUEST_SCORES_KEY, JSON.stringify(scores));
  } catch (error) {
    console.error('Error saving guest scores:', error);
  }
};

const getGuestMastery = () => {
  try {
    const stored = localStorage.getItem(GUEST_MASTERY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveGuestMastery = (mastery) => {
  try {
    localStorage.setItem(GUEST_MASTERY_KEY, JSON.stringify(mastery));
  } catch (error) {
    console.error('Error saving guest mastery:', error);
  }
};

// ============================================
// QUESTION HISTORY OPERATIONS
// ============================================

/**
 * Save a question attempt to history
 */
export const saveQuestionToHistory = async (entry) => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    if (isGuest) {
      const history = getGuestHistory();
      const newEntry = {
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...entry,
        created_at: new Date().toISOString(),
      };
      const updated = [newEntry, ...history].slice(0, 1000);
      saveGuestHistory(updated);
      return { success: true, data: newEntry };
    }

    // Supabase for authenticated users
    const { data, error } = await supabase
      .from('learning_history')
      .insert({
        user_id: userId,
        subject: entry.subject,
        topic: entry.topic,
        difficulty: entry.difficulty,
        question_style: entry.questionStyle,
        focus_mode: entry.focusMode,
        question: entry.question,
        question_type: entry.questionType,
        user_answer: entry.userAnswer,
        correct_answer: entry.correctAnswer,
        explanation: entry.explanation,
        result: entry.result,
        score: entry.score,
        time_taken: entry.timeTaken,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving question to history:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get question history
 */
export const getQuestionHistory = async (filters = {}) => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    if (isGuest) {
      let history = getGuestHistory();
      
      // Apply filters
      if (filters.subject) {
        history = history.filter(h => h.subject === filters.subject);
      }
      if (filters.topic) {
        history = history.filter(h => h.topic === filters.topic);
      }
      if (filters.result) {
        history = history.filter(h => h.result === filters.result);
      }
      if (filters.limit) {
        history = history.slice(0, filters.limit);
      }
      
      return { success: true, data: history };
    }

    // Supabase for authenticated users
    let query = supabase
      .from('learning_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.subject) query = query.eq('subject', filters.subject);
    if (filters.topic) query = query.eq('topic', filters.topic);
    if (filters.result) query = query.eq('result', filters.result);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching question history:', error);
    return { success: false, error: error.message, data: [] };
  }
};

// ============================================
// MASTERY OPERATIONS
// ============================================

/**
 * Get mastery data for a specific topic
 */
export const getMastery = async (subject, topic) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;

    const defaultMastery = {
      subject,
      topic,
      current_difficulty: 'medium',
      recommended_difficulty: 'medium',
      rolling_accuracy: 0.5,
      questions_at_current: 0,
      total_questions: 0,
      last_results: [],
      streak_eligible: true,
      difficulty_changes_session: 0,
      isNew: true,
    };

    if (isGuest) {
      const allMastery = getGuestMastery();
      const mastery = allMastery[key];
      
      if (!mastery) {
        return { success: true, data: defaultMastery };
      }
      
      return { success: true, data: { ...mastery, isNew: false } };
    }

    // Supabase for authenticated users
    const { data, error } = await supabase
      .from('learning_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic)
      .single();

    if (error && error.code === 'PGRST116') {
      return { success: true, data: defaultMastery };
    }

    if (error) throw error;
    return { success: true, data: { ...data, isNew: false } };
  } catch (error) {
    console.error('Error fetching mastery:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update mastery after answering a question
 * This is the core adaptive difficulty logic
 */
export const updateMastery = async (subject, topic, difficulty, score) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;

    // Get current mastery
    const { success, data: currentMastery } = await getMastery(subject, topic);
    if (!success) throw new Error('Failed to fetch current mastery');

    // Build new result entry
    const newResult = {
      score,
      difficulty,
      timestamp: new Date().toISOString(),
    };

    // Update rolling window
    const lastResults = [...(currentMastery.last_results || []), newResult]
      .slice(-ROLLING_WINDOW_SIZE);

    const rollingAccuracy = calculateRollingAccuracy(lastResults);

    // Track difficulty changes
    const difficultyChanged = difficulty !== currentMastery.current_difficulty;
    const questionsAtCurrent = difficultyChanged ? 1 : (currentMastery.questions_at_current || 0) + 1;
    const difficultyChangesSession = difficultyChanged
      ? (currentMastery.difficulty_changes_session || 0) + 1
      : currentMastery.difficulty_changes_session || 0;

    // Calculate recommendation
    let recommendedDifficulty = difficulty;
    let recommendation = null;

    const recentResults = lastResults.slice(-MIN_QUESTIONS_TO_JUDGE);
    if (recentResults.length >= MIN_QUESTIONS_TO_JUDGE) {
      const recentAccuracy = calculateRollingAccuracy(recentResults);

      if (recentAccuracy >= BUMP_UP_THRESHOLD && difficulty !== 'extreme') {
        recommendedDifficulty = getNextDifficultyUp(difficulty);
        recommendation = {
          type: 'suggest_up',
          message: `You're crushing it! Try ${recommendedDifficulty} mode?`,
          accuracy: Math.round(recentAccuracy * 100),
          newDifficulty: recommendedDifficulty,
        };
      } else if (recentAccuracy <= BUMP_DOWN_THRESHOLD && difficulty !== 'easy') {
        recommendedDifficulty = getNextDifficultyDown(difficulty);
        recommendation = {
          type: 'auto_down',
          message: `Dropping to ${recommendedDifficulty} to build foundations.`,
          accuracy: Math.round(recentAccuracy * 100),
          newDifficulty: recommendedDifficulty,
        };
      }
    }

    // Check streak farming
    let streakEligible = currentMastery.streak_eligible !== false;
    if (
      difficulty === 'easy' &&
      questionsAtCurrent >= STREAK_FARMING_THRESHOLD &&
      rollingAccuracy >= STREAK_FARMING_ACCURACY
    ) {
      streakEligible = false;
      recommendation = {
        type: 'streak_warning',
        message: `You've mastered Easy mode! Questions here won't count toward your streak anymore.`,
        accuracy: Math.round(rollingAccuracy * 100),
      };
    }

    // Check oscillation
    if (difficultyChangesSession >= OSCILLATION_LIMIT) {
      recommendation = {
        type: 'oscillation_warning',
        message: `Finding your level? Stick with one difficulty for 10 questions to get accurate feedback.`,
        suggestLock: true,
      };
    }

    // Build update object
    const masteryUpdate = {
      subject,
      topic,
      current_difficulty: difficulty,
      recommended_difficulty: recommendedDifficulty,
      rolling_accuracy: rollingAccuracy,
      questions_at_current: questionsAtCurrent,
      total_questions: (currentMastery.total_questions || 0) + 1,
      last_results: lastResults,
      streak_eligible: streakEligible,
      difficulty_changes_session: difficultyChangesSession,
      last_difficulty_change: difficultyChanged ? new Date().toISOString() : currentMastery.last_difficulty_change,
      updated_at: new Date().toISOString(),
    };

    if (isGuest) {
      const allMastery = getGuestMastery();
      allMastery[key] = masteryUpdate;
      saveGuestMastery(allMastery);
      return { success: true, data: masteryUpdate, recommendation };
    }

    // Supabase upsert
    const { data, error } = await supabase
      .from('learning_mastery')
      .upsert({
        user_id: userId,
        ...masteryUpdate,
      }, { onConflict: 'user_id,subject,topic' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data, recommendation };
  } catch (error) {
    console.error('Error updating mastery:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get recommended difficulty for a topic (used when starting practice)
 */
export const getRecommendedDifficulty = async (subject, topic) => {
  try {
    const { success, data } = await getMastery(subject, topic);

    if (!success || data.isNew) {
      return {
        difficulty: 'medium',
        isRecommendation: false,
        reason: 'New topic - starting at medium',
        mastery: null,
      };
    }

    const recommended = data.recommended_difficulty || data.current_difficulty || 'medium';
    const current = data.current_difficulty || 'medium';

    return {
      difficulty: recommended,
      isRecommendation: recommended !== current,
      reason: recommended !== current
        ? `Based on ${Math.round((data.rolling_accuracy || 0.5) * 100)}% recent accuracy`
        : 'Continuing at current level',
      mastery: data,
    };
  } catch (error) {
    console.error('Error getting recommended difficulty:', error);
    return {
      difficulty: 'medium',
      isRecommendation: false,
      reason: 'Error fetching mastery - defaulting to medium',
      mastery: null,
    };
  }
};

/**
 * Reset session counters (call at start of new practice session)
 */
export const resetSessionCounters = async (subject, topic) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;

    if (isGuest) {
      const allMastery = getGuestMastery();
      if (allMastery[key]) {
        allMastery[key].difficulty_changes_session = 0;
        saveGuestMastery(allMastery);
      }
      return { success: true };
    }

    await supabase
      .from('learning_mastery')
      .update({ difficulty_changes_session: 0 })
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic);

    return { success: true };
  } catch (error) {
    console.error('Error resetting session counters:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SCORE OPERATIONS
// ============================================

/**
 * Save or update best score for a topic
 */
export const saveBestScore = async (subject, topic, score, total) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;
    const percentage = Math.round((score / total) * 100);

    if (isGuest) {
      const scores = getGuestScores();
      const existing = scores[key];

      if (existing && percentage <= existing.percentage) {
        return { success: true, updated: false };
      }

      scores[key] = {
        best: Math.round(score),
        total,
        percentage,
        lastAttempt: new Date().toISOString(),
      };
      saveGuestScores(scores);
      return { success: true, updated: true };
    }

    // Check existing score
    const { data: existing } = await supabase
      .from('learning_scores')
      .select('best_percentage')
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic)
      .single();

    if (existing && percentage <= existing.best_percentage) {
      return { success: true, updated: false };
    }

    const { error } = await supabase
      .from('learning_scores')
      .upsert({
        user_id: userId,
        subject,
        topic,
        best_score: Math.round(score),
        best_total: total,
        best_percentage: percentage,
        last_attempt: new Date().toISOString(),
      }, { onConflict: 'user_id,subject,topic' });

    if (error) throw error;
    return { success: true, updated: true };
  } catch (error) {
    console.error('Error saving best score:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all scores for current user
 */
export const getAllScores = async () => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    if (isGuest) {
      return { success: true, data: getGuestScores() };
    }

    const { data, error } = await supabase
      .from('learning_scores')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    // Convert to object keyed by subject-topic
    const scoresObj = {};
    data.forEach(score => {
      scoresObj[`${score.subject}-${score.topic}`] = {
        best: score.best_score,
        total: score.best_total,
        percentage: score.best_percentage,
        lastAttempt: score.last_attempt,
      };
    });

    return { success: true, data: scoresObj };
  } catch (error) {
    console.error('Error fetching all scores:', error);
    return { success: false, error: error.message, data: {} };
  }
};

// ============================================
// PROGRESS STATISTICS
// ============================================

/**
 * Get comprehensive progress stats for dashboard
 */
export const getProgressStats = async () => {
  try {
    const { data: historyResult } = await getQuestionHistory({ limit: 1000 });
    const history = historyResult || [];

    const totalQuestions = history.length;
    const correctAnswers = history.filter(q => q.result === 'correct').length;
    const partialAnswers = history.filter(q => q.result === 'partial').length;
    const accuracyRate = totalQuestions > 0
      ? ((correctAnswers + partialAnswers * 0.5) / totalQuestions * 100).toFixed(1)
      : 0;
    
    const avgTime = totalQuestions > 0
      ? Math.round(history.reduce((sum, q) => sum + (q.time_taken || q.timeTaken || 0), 0) / totalQuestions)
      : 0;

    // Topic stats
    const topicStats = {};
    history.forEach(q => {
      const key = `${q.subject}-${q.topic}`;
      if (!topicStats[key]) {
        topicStats[key] = { subject: q.subject, topic: q.topic, correct: 0, total: 0, bestScore: 0 };
      }
      topicStats[key].total++;
      if (q.result === 'correct') topicStats[key].correct++;
      else if (q.result === 'partial') topicStats[key].correct += 0.5;
      const scorePercent = (topicStats[key].correct / topicStats[key].total) * 100;
      topicStats[key].bestScore = Math.max(topicStats[key].bestScore, scorePercent);
    });

    // Streak calculation
    const uniqueDates = [...new Set(history.map(q =>
      new Date(q.created_at || q.timestamp).toDateString()
    ))].sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currDate = new Date(uniqueDates[i]);
        if (Math.round((prevDate - currDate) / 86400000) === 1) streak++;
        else break;
      }
    }

    return {
      success: true,
      data: {
        totalQuestions,
        accuracyRate,
        avgTime,
        topicStats: Object.values(topicStats),
        streak,
      }
    };
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// MIGRATION: Guest to Authenticated
// ============================================

/**
 * Migrate guest data to authenticated user's Supabase account
 * Call this after a guest user signs up/logs in
 */
export const migrateGuestDataToSupabase = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    const migrationKey = `learning-migrated-${user.id}`;
    if (localStorage.getItem(migrationKey)) {
      return { success: true, alreadyMigrated: true };
    }

    let migratedHistory = 0;
    let migratedScores = 0;
    let migratedMastery = 0;

    // Migrate history
    const guestHistory = getGuestHistory();
    if (guestHistory.length > 0) {
      const historyInserts = guestHistory.map(entry => ({
        user_id: user.id,
        subject: entry.subject,
        topic: entry.topic,
        difficulty: entry.difficulty,
        question_style: entry.questionStyle || entry.question_style,
        focus_mode: entry.focusMode || entry.focus_mode,
        question: entry.question,
        question_type: entry.questionType || entry.question_type,
        user_answer: entry.userAnswer || entry.user_answer,
        correct_answer: entry.correctAnswer || entry.correct_answer,
        explanation: entry.explanation,
        result: entry.result,
        score: entry.score,
        time_taken: entry.timeTaken || entry.time_taken,
        created_at: entry.created_at || entry.timestamp,
      }));

      // Insert in batches of 100
      for (let i = 0; i < historyInserts.length; i += 100) {
        const batch = historyInserts.slice(i, i + 100);
        await supabase.from('learning_history').insert(batch);
        migratedHistory += batch.length;
      }
    }

    // Migrate scores
    const guestScores = getGuestScores();
    const scoreKeys = Object.keys(guestScores);
    if (scoreKeys.length > 0) {
      const scoreInserts = scoreKeys.map(key => {
        const [subject, ...topicParts] = key.split('-');
        const topic = topicParts.join('-');
        const score = guestScores[key];
        return {
          user_id: user.id,
          subject,
          topic,
          best_score: score.best,
          best_total: score.total,
          best_percentage: score.percentage,
          last_attempt: score.lastAttempt,
        };
      });

      await supabase
        .from('learning_scores')
        .upsert(scoreInserts, { onConflict: 'user_id,subject,topic' });
      migratedScores = scoreInserts.length;
    }

    // Migrate mastery
    const guestMastery = getGuestMastery();
    const masteryKeys = Object.keys(guestMastery);
    if (masteryKeys.length > 0) {
      const masteryInserts = masteryKeys.map(key => {
        const mastery = guestMastery[key];
        return {
          user_id: user.id,
          subject: mastery.subject,
          topic: mastery.topic,
          current_difficulty: mastery.current_difficulty,
          recommended_difficulty: mastery.recommended_difficulty,
          rolling_accuracy: mastery.rolling_accuracy,
          questions_at_current: mastery.questions_at_current,
          total_questions: mastery.total_questions,
          last_results: mastery.last_results,
          streak_eligible: mastery.streak_eligible,
          difficulty_changes_session: 0, // Reset for new session
        };
      });

      await supabase
        .from('learning_mastery')
        .upsert(masteryInserts, { onConflict: 'user_id,subject,topic' });
      migratedMastery = masteryInserts.length;
    }

    // Mark as migrated
    localStorage.setItem(migrationKey, new Date().toISOString());

    // Clear guest data after successful migration
    localStorage.removeItem(GUEST_HISTORY_KEY);
    localStorage.removeItem(GUEST_SCORES_KEY);
    localStorage.removeItem(GUEST_MASTERY_KEY);

    return {
      success: true,
      migrated: {
        history: migratedHistory,
        scores: migratedScores,
        mastery: migratedMastery,
      }
    };
  } catch (error) {
    console.error('Error migrating guest data:', error);
    return { success: false, error: error.message };
  }
};
