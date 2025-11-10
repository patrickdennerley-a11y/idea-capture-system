import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, initialValue) {
  // Get stored value or use initial value
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  // Track timeout for debouncing
  const timeoutRef = useRef(null);

  // Debounced update to localStorage (500ms delay to batch rapid updates)
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for writing to localStorage
    timeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
      }
    }, 500); // 500ms debounce

    // Cleanup on unmount or before next update
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
