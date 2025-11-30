// Use relative URLs for both dev (Vite proxy) and production (same origin)
const API_BASE_URL = '';

// Retry logic helper
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      // Don't retry on network errors if backend is down
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        throw new Error('Backend server is not responding. Please make sure it\'s running on port 3001.');
      }

      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  throw lastError;
};

/**
 * Send captured ideas to backend for AI organization
 * @param {Array} ideas - Array of idea objects
 * @returns {Promise} - Organized ideas with themes and priorities
 */
export const organizeIdeas = async (ideas) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/organize-ideas`, {
      method: 'POST',
      body: JSON.stringify({ ideas }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error organizing ideas:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get AI-generated weekly summary of ideas and logs
 * @param {Array} ideas - Array of idea objects
 * @returns {Promise} - Weekly summary analysis
 */
export const getWeeklySummary = async (ideas) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/weekly-summary`, {
      method: 'POST',
      body: JSON.stringify({ ideas }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Analyze patterns in logs and ideas to find correlations
 * @param {Array} logs - Array of energy/motivation log objects
 * @param {Array} ideas - Array of idea objects
 * @returns {Promise} - Pattern analysis with correlations
 */
export const analyzePatterns = async (logs, ideas) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/analyze-patterns`, {
      method: 'POST',
      body: JSON.stringify({ logs, ideas }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error analyzing patterns:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Classify a study subject into hierarchical categories
 * @param {string} subject - The subject being studied (e.g., "Group Theory", "Quantum Mechanics")
 * @returns {Promise} - Hierarchical classification (e.g., Math -> Algebra -> Group Theory)
 */
export const classifySubject = async (subject) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/classify-subject`, {
      method: 'POST',
      body: JSON.stringify({ subject }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error classifying subject:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get AI planning advice for an activity based on user data
 * @param {string} activity - The activity to plan
 * @param {Array} ideas - Array of captured ideas
 * @param {Array} logs - Array of activity logs
 * @param {Object} checklist - Daily checklist data
 * @param {Array} reviews - Array of end-of-day reviews
 * @returns {Promise} - Planning advice with suggestions
 */
export const getPlanningAdvice = async (activity, ideas, logs, checklist, reviews) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/plan-activity`, {
      method: 'POST',
      body: JSON.stringify({ activity, ideas, logs, checklist, reviews }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error getting planning advice:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate AI-powered daily routine based on all user data
 * @param {Array} ideas - Array of captured ideas
 * @param {Array} logs - Array of activity logs
 * @param {Object} checklist - Daily checklist data
 * @param {Array} reviews - Array of end-of-day reviews
 * @returns {Promise} - Generated daily routine with time blocks
 */
export const generateDailyRoutine = async (ideas, logs, checklist, reviews) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/generate-routine`, {
      method: 'POST',
      body: JSON.stringify({ ideas, logs, checklist, reviews }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error generating daily routine:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get smart reminders based on user profile and history
 * @param {Array} ideas - Array of idea objects
 * @param {Array} logs - Array of activity logs
 * @param {Object} checklist - Daily checklist data
 * @param {Array} reviews - Array of end-of-day reviews
 * @param {Array} reminderHistory - History of shown/dismissed reminders
 * @returns {Promise} - Smart reminders with adaptive frequency
 */
export const getReminders = async (ideas, logs, checklist, reviews, reminderHistory) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/get-reminders`, {
      method: 'POST',
      body: JSON.stringify({ ideas, logs, checklist, reviews, reminderHistory }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error getting reminders:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Evaluate a student's answer using AI semantic analysis
 * @param {string} question - The question that was asked
 * @param {string} userAnswer - The student's answer
 * @param {string} correctAnswer - The expected correct answer
 * @param {string} questionType - Type of question (short_answer, calculation, etc.)
 * @returns {Promise} - Evaluation result with score and feedback
 */
export const evaluateAnswer = async (question, userAnswer, correctAnswer, questionType) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/evaluate-answer`, {
      method: 'POST',
      body: JSON.stringify({ question, userAnswer, correctAnswer, questionType }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error evaluating answer:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate practice questions for learning
 * @param {string} subject - The subject area (e.g., "Statistics")
 * @param {string} topic - The specific topic (e.g., "Hypothesis Testing")
 * @param {string} difficulty - Difficulty level (easy, medium, hard, extreme)
 * @param {number} questionCount - Number of questions to generate
 * @param {string} questionStyle - Question style (balanced, conceptual, calculation, formula, application)
 * @param {string} focusMode - Focus mode (understanding, memorization, holistic)
 * @returns {Promise} - Generated questions with answers and explanations
 */
export const generatePracticeQuestions = async (
  subject,
  topic,
  difficulty = 'medium',
  questionCount = 5,
  questionStyle = 'balanced',
  focusMode = 'understanding'
) => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/generate-practice-questions`, {
      method: 'POST',
      body: JSON.stringify({
        subject,
        topic,
        difficulty,
        questionCount,
        questionStyle,
        focusMode
      }),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('Error generating practice questions:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate a condensed cheat sheet for a topic
 * @param {string} subject - The subject area (e.g., "Statistics")
 * @param {string} topic - The specific topic (e.g., "Hypothesis Testing")
 * @param {string} topicDescription - Optional description of the topic
 * @returns {Promise} - Generated cheat sheet content with markdown formatting
 */
export const generateCheatsheet = async (subject, topic, topicDescription = '') => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for longer generation

    const response = await fetch(`${API_BASE_URL}/api/generate-cheatsheet`, {
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
        error: 'Request timed out. The cheat sheet generation is taking longer than expected. Please try again.',
      };
    }
    console.error('Error generating cheat sheet:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate cheat sheet. Please try again.',
    };
  }
};

/**
 * Extract and evaluate answer from an uploaded image using AI vision
 * @param {string} imageBase64 - Base64-encoded image (with or without data URI prefix)
 * @param {string} question - The question being answered
 * @param {string} correctAnswer - The expected correct answer
 * @returns {Promise} - Evaluation result with extractedWork, finalAnswer, result, score, feedback
 */
export const extractAnswerFromImage = async (imageBase64, question, correctAnswer) => {
  try {
    // Strip the data:image/...;base64, prefix if present
    let image = imageBase64;
    let mediaType = 'image/png'; // default
    
    if (imageBase64.startsWith('data:')) {
      const matches = imageBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (matches) {
        mediaType = matches[1];
        image = matches[2];
      } else {
        // Fallback: just remove the prefix
        image = imageBase64.split(',')[1] || imageBase64;
      }
    }

    // Use AbortController for 30 second timeout (vision processing takes longer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${API_BASE_URL}/api/extract-answer-from-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image, mediaType, question, correctAnswer }),
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
        error: 'Request timed out. Image processing is taking too long. Please try again or type your answer manually.',
      };
    }
    console.error('Error extracting answer from image:', error);
    return {
      success: false,
      error: error.message || 'Failed to process image. Please try again or type your answer manually.',
    };
  }
};

/**
 * Generate AI-powered flashcards for a topic
 * @param {string} subject - The subject area (e.g., "Statistics")
 * @param {string} topic - The specific topic (e.g., "Descriptive Statistics")
 * @param {string} topicDescription - Optional description of the topic
 * @returns {Promise} - Generated flashcards with formulas, definitions, concepts
 */
export const generateFlashcards = async (subject, topic, topicDescription = '') => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for longer generation

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

/**
 * Health check to verify backend is running
 * @returns {Promise<boolean>} - True if backend is healthy
 */
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};
