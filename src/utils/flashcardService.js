/**
 * FLASHCARD SERVICE
 * 
 * Handles all data operations for the flashcard system:
 * - Deck storage and retrieval
 * - Spaced repetition (SM-2 algorithm)
 * - Progress tracking
 * 
 * Supports both:
 * - Authenticated users (Supabase)
 * - Guest users (localStorage fallback)
 */

import { supabase } from '../supabaseClient';

// ============================================
// CONSTANTS
// ============================================

const API_BASE_URL = '';

// localStorage keys for guest mode
const GUEST_DECKS_KEY = 'flashcard-decks';
const GUEST_PROGRESS_KEY = 'flashcard-progress';

// SM-2 Algorithm defaults
const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

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
// GUEST MODE HELPERS
// ============================================

const getGuestDecks = () => {
  try {
    const stored = localStorage.getItem(GUEST_DECKS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveGuestDecks = (decks) => {
  try {
    localStorage.setItem(GUEST_DECKS_KEY, JSON.stringify(decks));
  } catch (error) {
    console.error('Error saving guest decks:', error);
  }
};

const getGuestProgress = () => {
  try {
    const stored = localStorage.getItem(GUEST_PROGRESS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveGuestProgress = (progress) => {
  try {
    localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving guest progress:', error);
  }
};

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Generate flashcards from the AI backend
 * @param {string} subject - The subject area
 * @param {string} topic - The specific topic
 * @param {string} topicDescription - Optional description
 * @returns {Promise} - Generated cards
 */
export const generateFlashcards = async (subject, topic, topicDescription = '') => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(`${API_BASE_URL}/api/generate-flashcards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, topic, topicDescription }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. Flashcard generation is taking longer than expected. Please try again.',
      };
    }
    console.error('Error generating flashcards:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate flashcards. Please try again.',
    };
  }
};

// ============================================
// DECK OPERATIONS
// ============================================

/**
 * Save a flashcard deck
 * @param {string} subject - Subject area
 * @param {string} topic - Topic name
 * @param {Array} cards - Array of card objects
 * @returns {Promise} - Saved deck with ID
 */
export const saveDeck = async (subject, topic, cards) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;

    if (isGuest) {
      const decks = getGuestDecks();
      const existingDeck = decks[key];
      
      const deck = {
        id: existingDeck?.id || `local-deck-${Date.now()}`,
        subject,
        topic,
        cards,
        createdAt: existingDeck?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      decks[key] = deck;
      saveGuestDecks(decks);
      
      return { success: true, data: deck };
    }

    // Supabase upsert for authenticated users
    const { data, error } = await supabase
      .from('flashcard_decks')
      .upsert({
        user_id: userId,
        subject,
        topic,
        cards,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,subject,topic' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving deck:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a flashcard deck for a specific subject/topic
 * @param {string} subject - Subject area
 * @param {string} topic - Topic name
 * @returns {Promise} - Deck or null
 */
export const getDeck = async (subject, topic) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;

    if (isGuest) {
      const decks = getGuestDecks();
      const deck = decks[key];
      return { success: true, data: deck || null };
    }

    // Supabase for authenticated users
    const { data, error } = await supabase
      .from('flashcard_decks')
      .select('*')
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic)
      .single();

    if (error && error.code === 'PGRST116') {
      // No deck found
      return { success: true, data: null };
    }

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error getting deck:', error);
    return { success: false, error: error.message, data: null };
  }
};

/**
 * Delete a flashcard deck
 * @param {string} subject - Subject area
 * @param {string} topic - Topic name
 * @returns {Promise} - Success status
 */
export const deleteDeck = async (subject, topic) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${subject}-${topic}`;

    if (isGuest) {
      const decks = getGuestDecks();
      delete decks[key];
      saveGuestDecks(decks);
      
      // Also clear progress for this deck
      const progress = getGuestProgress();
      Object.keys(progress).forEach(deckId => {
        if (deckId.includes(key)) {
          delete progress[deckId];
        }
      });
      saveGuestProgress(progress);
      
      return { success: true };
    }

    // Get deck ID first
    const { data: deck } = await supabase
      .from('flashcard_decks')
      .select('id')
      .eq('user_id', userId)
      .eq('subject', subject)
      .eq('topic', topic)
      .single();

    if (deck) {
      // Delete progress first (foreign key constraint)
      await supabase
        .from('flashcard_progress')
        .delete()
        .eq('deck_id', deck.id);

      // Delete deck
      const { error } = await supabase
        .from('flashcard_decks')
        .delete()
        .eq('id', deck.id);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting deck:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// PROGRESS OPERATIONS (SM-2 ALGORITHM)
// ============================================

/**
 * Get progress for a specific card
 * @param {string} deckId - Deck ID
 * @param {string} cardId - Card ID within the deck
 * @returns {Promise} - Progress data or defaults
 */
export const getCardProgress = async (deckId, cardId) => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    const defaultProgress = {
      easeFactor: DEFAULT_EASE_FACTOR,
      intervalDays: 0,
      repetitions: 0,
      nextReview: new Date().toISOString(),
      lastReviewed: null,
    };

    if (isGuest) {
      const allProgress = getGuestProgress();
      const deckProgress = allProgress[deckId] || {};
      const cardProgress = deckProgress[cardId];
      
      if (!cardProgress) {
        return { success: true, data: defaultProgress };
      }
      
      return { success: true, data: cardProgress };
    }

    // Supabase for authenticated users
    const { data, error } = await supabase
      .from('flashcard_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .eq('card_id', cardId)
      .single();

    if (error && error.code === 'PGRST116') {
      return { success: true, data: defaultProgress };
    }

    if (error) throw error;
    
    return {
      success: true,
      data: {
        easeFactor: data.ease_factor,
        intervalDays: data.interval_days,
        repetitions: data.repetitions,
        nextReview: data.next_review,
        lastReviewed: data.last_reviewed,
      }
    };
  } catch (error) {
    console.error('Error getting card progress:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update card progress using SM-2 algorithm
 * @param {string} deckId - Deck ID
 * @param {string} cardId - Card ID within the deck
 * @param {number} quality - Rating 0-5 (0=complete fail, 5=perfect)
 * @returns {Promise} - Updated progress
 * 
 * SM-2 Algorithm:
 * - quality >= 3 (correct):
 *   - if repetitions == 0: interval = 1 day
 *   - else if repetitions == 1: interval = 6 days
 *   - else: interval = previous_interval * ease_factor
 *   - ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
 *   - if ease_factor < 1.3: ease_factor = 1.3
 *   - repetitions += 1
 * - quality < 3 (incorrect):
 *   - repetitions = 0
 *   - interval = 1 day
 */
export const updateCardProgress = async (deckId, cardId, quality) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    
    // Get current progress
    const { data: currentProgress } = await getCardProgress(deckId, cardId);
    
    let easeFactor = currentProgress?.easeFactor || DEFAULT_EASE_FACTOR;
    let intervalDays = currentProgress?.intervalDays || 0;
    let repetitions = currentProgress?.repetitions || 0;

    const now = new Date();

    if (quality >= 3) {
      // Correct answer
      if (repetitions === 0) {
        intervalDays = 1;
      } else if (repetitions === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      
      // Update ease factor
      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (easeFactor < MIN_EASE_FACTOR) {
        easeFactor = MIN_EASE_FACTOR;
      }
      
      repetitions += 1;
    } else {
      // Incorrect answer - reset
      repetitions = 0;
      intervalDays = 1;
      // Don't reduce ease factor below minimum on failure
      easeFactor = Math.max(easeFactor - 0.2, MIN_EASE_FACTOR);
    }

    // Calculate next review date
    const nextReview = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    const progressUpdate = {
      easeFactor,
      intervalDays,
      repetitions,
      nextReview: nextReview.toISOString(),
      lastReviewed: now.toISOString(),
    };

    if (isGuest) {
      const allProgress = getGuestProgress();
      if (!allProgress[deckId]) {
        allProgress[deckId] = {};
      }
      allProgress[deckId][cardId] = progressUpdate;
      saveGuestProgress(allProgress);
      
      return { success: true, data: progressUpdate };
    }

    // Supabase upsert for authenticated users
    const { data, error } = await supabase
      .from('flashcard_progress')
      .upsert({
        user_id: userId,
        deck_id: deckId,
        card_id: cardId,
        ease_factor: easeFactor,
        interval_days: intervalDays,
        repetitions,
        next_review: nextReview.toISOString(),
        last_reviewed: now.toISOString(),
      }, { onConflict: 'user_id,deck_id,card_id' })
      .select()
      .single();

    if (error) throw error;
    
    return { success: true, data: progressUpdate };
  } catch (error) {
    console.error('Error updating card progress:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all cards that are due for review
 * @param {string} deckId - Deck ID
 * @param {Array} cards - Array of cards in the deck
 * @returns {Promise} - Array of due cards sorted by most overdue
 */
export const getDueCards = async (deckId, cards) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const now = new Date();

    if (isGuest) {
      const allProgress = getGuestProgress();
      const deckProgress = allProgress[deckId] || {};
      
      const dueCards = cards.filter(card => {
        const progress = deckProgress[card.id];
        if (!progress) return true; // New cards are due
        return new Date(progress.nextReview) <= now;
      });
      
      // Sort by most overdue first
      dueCards.sort((a, b) => {
        const progressA = deckProgress[a.id];
        const progressB = deckProgress[b.id];
        const dateA = progressA ? new Date(progressA.nextReview) : new Date(0);
        const dateB = progressB ? new Date(progressB.nextReview) : new Date(0);
        return dateA - dateB;
      });
      
      return { success: true, data: dueCards };
    }

    // Supabase for authenticated users
    const { data: progressData, error } = await supabase
      .from('flashcard_progress')
      .select('card_id, next_review')
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .lte('next_review', now.toISOString());

    if (error) throw error;

    // Map progress to card IDs
    const progressMap = new Map(progressData?.map(p => [p.card_id, p.next_review]) || []);
    
    // Filter cards: include due cards and new cards (not in progress)
    const reviewedCardIds = new Set(progressData?.map(p => p.card_id) || []);
    
    // Get all progress to check for new cards
    const { data: allProgressData } = await supabase
      .from('flashcard_progress')
      .select('card_id')
      .eq('user_id', userId)
      .eq('deck_id', deckId);
    
    const allReviewedIds = new Set(allProgressData?.map(p => p.card_id) || []);
    
    const dueCards = cards.filter(card => {
      // New cards (never reviewed) are due
      if (!allReviewedIds.has(card.id)) return true;
      // Cards with due review
      return reviewedCardIds.has(card.id);
    });
    
    // Sort by most overdue first
    dueCards.sort((a, b) => {
      const dateA = progressMap.get(a.id) ? new Date(progressMap.get(a.id)) : new Date(0);
      const dateB = progressMap.get(b.id) ? new Date(progressMap.get(b.id)) : new Date(0);
      return dateA - dateB;
    });
    
    return { success: true, data: dueCards };
  } catch (error) {
    console.error('Error getting due cards:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Get a study session with prioritized cards
 * @param {string} subject - Subject area
 * @param {string} topic - Topic name
 * @param {number} maxCards - Maximum cards to return
 * @returns {Promise} - Ordered array of cards to study
 */
export const getStudySession = async (subject, topic, maxCards = 20) => {
  try {
    // Get the deck
    const { data: deck } = await getDeck(subject, topic);
    
    if (!deck || !deck.cards || deck.cards.length === 0) {
      return { success: true, data: { cards: [], deck: null, stats: null } };
    }

    const deckId = deck.id;
    const allCards = deck.cards;

    // Get due cards
    const { data: dueCards } = await getDueCards(deckId, allCards);
    
    // Build session: prioritize due cards, then add unreviewed if needed
    const sessionCards = [];
    const { userId, isGuest } = await getCurrentUser();
    
    // Get progress for all cards to identify unreviewed
    let progressMap = new Map();
    
    if (isGuest) {
      const allProgress = getGuestProgress();
      const deckProgress = allProgress[deckId] || {};
      Object.entries(deckProgress).forEach(([cardId, progress]) => {
        progressMap.set(cardId, progress);
      });
    } else {
      const { data: progressData } = await supabase
        .from('flashcard_progress')
        .select('card_id, repetitions')
        .eq('user_id', userId)
        .eq('deck_id', deckId);
      
      if (progressData) {
        progressData.forEach(p => progressMap.set(p.card_id, p));
      }
    }

    // Add due cards first
    for (const card of dueCards) {
      if (sessionCards.length >= maxCards) break;
      sessionCards.push(card);
    }

    // If we need more cards, add unreviewed ones
    if (sessionCards.length < maxCards) {
      const sessionCardIds = new Set(sessionCards.map(c => c.id));
      const unreviewed = allCards.filter(card => 
        !progressMap.has(card.id) && !sessionCardIds.has(card.id)
      );
      
      for (const card of unreviewed) {
        if (sessionCards.length >= maxCards) break;
        sessionCards.push(card);
      }
    }

    // Calculate stats
    const dueCount = dueCards.length;
    const newCount = allCards.filter(c => !progressMap.has(c.id)).length;
    const reviewedCount = allCards.length - newCount;

    return {
      success: true,
      data: {
        cards: sessionCards,
        deck,
        stats: {
          totalCards: allCards.length,
          dueCards: dueCount,
          newCards: newCount,
          reviewedCards: reviewedCount,
          sessionSize: sessionCards.length,
        }
      }
    };
  } catch (error) {
    console.error('Error getting study session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get progress statistics for a deck
 * @param {string} deckId - Deck ID
 * @param {Array} cards - Array of cards in the deck
 * @returns {Promise} - Progress statistics
 */
export const getDeckStats = async (deckId, cards) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const now = new Date();

    let masteredCount = 0;
    let learningCount = 0;
    let newCount = 0;
    let dueCount = 0;

    if (isGuest) {
      const allProgress = getGuestProgress();
      const deckProgress = allProgress[deckId] || {};
      
      cards.forEach(card => {
        const progress = deckProgress[card.id];
        if (!progress) {
          newCount++;
          dueCount++;
        } else {
          if (progress.intervalDays >= 21) {
            masteredCount++;
          } else {
            learningCount++;
          }
          if (new Date(progress.nextReview) <= now) {
            dueCount++;
          }
        }
      });
    } else {
      const { data: progressData } = await supabase
        .from('flashcard_progress')
        .select('card_id, interval_days, next_review')
        .eq('user_id', userId)
        .eq('deck_id', deckId);

      const progressMap = new Map(progressData?.map(p => [p.card_id, p]) || []);
      
      cards.forEach(card => {
        const progress = progressMap.get(card.id);
        if (!progress) {
          newCount++;
          dueCount++;
        } else {
          if (progress.interval_days >= 21) {
            masteredCount++;
          } else {
            learningCount++;
          }
          if (new Date(progress.next_review) <= now) {
            dueCount++;
          }
        }
      });
    }

    return {
      success: true,
      data: {
        total: cards.length,
        mastered: masteredCount,
        learning: learningCount,
        new: newCount,
        due: dueCount,
      }
    };
  } catch (error) {
    console.error('Error getting deck stats:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// MIGRATION: Guest to Authenticated
// ============================================

/**
 * Migrate guest flashcard data to authenticated user's Supabase account
 */
export const migrateGuestFlashcardsToSupabase = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    const migrationKey = `flashcards-migrated-${user.id}`;
    if (localStorage.getItem(migrationKey)) {
      return { success: true, alreadyMigrated: true };
    }

    let migratedDecks = 0;
    let migratedProgress = 0;

    // Migrate decks
    const guestDecks = getGuestDecks();
    const deckKeys = Object.keys(guestDecks);
    
    for (const key of deckKeys) {
      const deck = guestDecks[key];
      
      const { data: savedDeck, error } = await supabase
        .from('flashcard_decks')
        .upsert({
          user_id: user.id,
          subject: deck.subject,
          topic: deck.topic,
          cards: deck.cards,
          created_at: deck.createdAt,
          updated_at: deck.updatedAt,
        }, { onConflict: 'user_id,subject,topic' })
        .select()
        .single();

      if (!error && savedDeck) {
        migratedDecks++;
        
        // Migrate progress for this deck
        const guestProgress = getGuestProgress();
        const deckProgress = guestProgress[deck.id];
        
        if (deckProgress) {
          const progressInserts = Object.entries(deckProgress).map(([cardId, progress]) => ({
            user_id: user.id,
            deck_id: savedDeck.id,
            card_id: cardId,
            ease_factor: progress.easeFactor,
            interval_days: progress.intervalDays,
            repetitions: progress.repetitions,
            next_review: progress.nextReview,
            last_reviewed: progress.lastReviewed,
          }));

          if (progressInserts.length > 0) {
            await supabase
              .from('flashcard_progress')
              .upsert(progressInserts, { onConflict: 'user_id,deck_id,card_id' });
            migratedProgress += progressInserts.length;
          }
        }
      }
    }

    // Mark as migrated
    localStorage.setItem(migrationKey, new Date().toISOString());

    // Clear guest data after successful migration
    localStorage.removeItem(GUEST_DECKS_KEY);
    localStorage.removeItem(GUEST_PROGRESS_KEY);

    return {
      success: true,
      migrated: {
        decks: migratedDecks,
        progress: migratedProgress,
      }
    };
  } catch (error) {
    console.error('Error migrating guest flashcard data:', error);
    return { success: false, error: error.message };
  }
};
