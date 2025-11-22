// Use relative URLs - works for both development (with Vite proxy) and production (same origin)
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
