import { useState, useEffect } from "react";

/**
 * Custom hook for debouncing values without causing parent re-renders
 * @param {any} value - The value to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {any} - The debounced value
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue((prev) => {
        // Only update if the value has actually changed
        // Use JSON.stringify for deep comparison of objects/arrays
        const prevStr = JSON.stringify(prev);
        const valueStr = JSON.stringify(value);
        return prevStr === valueStr ? prev : value;
      });
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
