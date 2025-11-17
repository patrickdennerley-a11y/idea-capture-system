// Use Vite proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:3001';

// Type definitions
export interface Idea {
  id: string;
  text: string;
  timestamp: string;
  category?: string;
  priority?: string;
  theme?: string;
  [key: string]: any;
}

export interface Log {
  id: string;
  timestamp: string;
  energy?: number;
  motivation?: number;
  activity?: string;
  [key: string]: any;
}

export interface Checklist {
  [key: string]: any;
}

export interface Review {
  id: string;
  date: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Retry logic helper
const fetchWithRetry = async <T = any>(url: string, options: FetchOptions = {}, maxRetries: number = 3): Promise<T> => {
  let lastError: Error = new Error('Unknown error');

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
      lastError = error as Error;

      // Don't retry on network errors if backend is down
      if (lastError.message.includes('fetch') || lastError.message.includes('NetworkError')) {
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
 * @param ideas - Array of idea objects
 * @returns Organized ideas with themes and priorities
 */
export const organizeIdeas = async (ideas: Idea[]): Promise<ApiResponse> => {
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
      error: (error as Error).message,
    };
  }
};

/**
 * Get AI-generated weekly summary of ideas and logs
 * @param ideas - Array of idea objects
 * @returns Weekly summary analysis
 */
export const getWeeklySummary = async (ideas: Idea[]): Promise<ApiResponse> => {
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
      error: (error as Error).message,
    };
  }
};

/**
 * Analyze patterns in logs and ideas to find correlations
 * @param logs - Array of energy/motivation log objects
 * @param ideas - Array of idea objects
 * @returns Pattern analysis with correlations
 */
export const analyzePatterns = async (logs: Log[], ideas: Idea[]): Promise<ApiResponse> => {
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
      error: (error as Error).message,
    };
  }
};

/**
 * Classify a study subject into hierarchical categories
 * @param subject - The subject being studied (e.g., "Group Theory", "Quantum Mechanics")
 * @returns Hierarchical classification (e.g., Math -> Algebra -> Group Theory)
 */
export const classifySubject = async (subject: string): Promise<ApiResponse> => {
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
      error: (error as Error).message,
    };
  }
};

/**
 * Get AI planning advice for an activity based on user data
 * @param activity - The activity to plan
 * @param ideas - Array of captured ideas
 * @param logs - Array of activity logs
 * @param checklist - Daily checklist data
 * @param reviews - Array of end-of-day reviews
 * @returns Planning advice with suggestions
 */
export const getPlanningAdvice = async (
  activity: string,
  ideas: Idea[],
  logs: Log[],
  checklist: Checklist,
  reviews: Review[]
): Promise<ApiResponse> => {
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
      error: (error as Error).message,
    };
  }
};

/**
 * Generate AI-powered daily routine based on all user data
 * @param ideas - Array of captured ideas
 * @param logs - Array of activity logs
 * @param checklist - Daily checklist data
 * @param reviews - Array of end-of-day reviews
 * @returns Generated daily routine with time blocks
 */
export const generateDailyRoutine = async (
  ideas: Idea[],
  logs: Log[],
  checklist: Checklist,
  reviews: Review[]
): Promise<ApiResponse> => {
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
      error: (error as Error).message,
    };
  }
};

/**
 * Health check to verify backend is running
 * @returns True if backend is healthy
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const baseUrl = import.meta.env.DEV ? 'http://localhost:3001' : API_BASE_URL;
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};
