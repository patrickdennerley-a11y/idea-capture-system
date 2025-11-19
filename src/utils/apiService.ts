// Use Vite proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Retry logic helper
const fetchWithRetry = async <T>(url: string, options: FetchOptions, maxRetries = 3): Promise<T> => {
  let lastError: Error | undefined;

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
        const errorData = await response.json().catch(() => ({})) as { error?: string };
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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Send captured ideas to backend for AI organization
 */
export const organizeIdeas = async (ideas: any[]): Promise<ApiResponse<unknown>> => {
  try {
    const response = await fetchWithRetry<unknown>(`${API_BASE_URL}/api/organize-ideas`, {
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
 */
export const getWeeklySummary = async (ideas: any[]): Promise<ApiResponse<unknown>> => {
  try {
    const response = await fetchWithRetry<unknown>(`${API_BASE_URL}/api/weekly-summary`, {
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
 */
export const analyzePatterns = async (logs: any[], ideas: any[]): Promise<ApiResponse<unknown>> => {
  try {
    const response = await fetchWithRetry<unknown>(`${API_BASE_URL}/api/analyze-patterns`, {
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
 */
export const classifySubject = async (subject: string): Promise<ApiResponse<unknown>> => {
  try {
    const response = await fetchWithRetry<unknown>(`${API_BASE_URL}/api/classify-subject`, {
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
 */
export const getPlanningAdvice = async (
  activity: string,
  ideas: any[],
  logs: any[],
  checklist: any,
  reviews: any[]
): Promise<ApiResponse<unknown>> => {
  try {
    const response = await fetchWithRetry<unknown>(`${API_BASE_URL}/api/plan-activity`, {
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
 */
export const generateDailyRoutine = async (
  ideas: any[],
  logs: any[],
  checklist: any,
  reviews: any[]
): Promise<ApiResponse<unknown>> => {
  try {
    const response = await fetchWithRetry<unknown>(`${API_BASE_URL}/api/generate-routine`, {
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
