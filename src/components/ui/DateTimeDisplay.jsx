"use client";

import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";
import Tooltip from "@/components/ui/Tooltip";

/**
 * Get user's timezone preferences from localStorage
 * @returns {Object} User's timezone and time format preferences
 */
export const getUserTimezonePreferences = () => {
  if (typeof window === "undefined") {
    return { timezone: "UTC", timeFormat: "24-hour" };
  }

  try {
    const preferences = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.USER_TIMEZONE_PREFERENCES) || "{}"
    );
    return {
      timezone: preferences.timezone?.name || "UTC",
      timeFormat: preferences.timeFormat || "24-hour",
    };
  } catch (error) {
    console.error("Error loading timezone preferences:", error);
    return { timezone: "UTC", timeFormat: "24-hour" };
  }
};

/**
 * Format date for chart labels with user's timezone
 * @param {Date|string|number} timestamp - The date to format
 * @param {string} period - The chart period (1H, 1D, 1W, 1M, 1Y, All)
 * @returns {string} Formatted date string
 */
export const formatChartDate = (timestamp, period = "1Y") => {
  if (!timestamp) return "";

  const { timezone } = getUserTimezonePreferences();
  const date = new Date(timestamp);

  // For hourly data, show time
  if (period === "1H") {
    return date.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // For daily data, show date without year
  if (period === "1D" || period === "1W") {
    return date.toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    });
  }

  // For monthly/yearly data, show month and year
  if (period === "1M" || period === "1Y" || period === "All") {
    return date.toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "short",
      year: "numeric",
    });
  }

  // Default: full date
  return date.toLocaleDateString("en-US", {
    timeZone: timezone,
  });
};

/**
 * Format date and time with user's timezone (for Chart.js tooltips)
 * @param {Date|string|number} timestamp - The date to format
 * @param {string} overrideTimezone - Optional timezone to override user preference
 * @returns {string} Formatted date and time string
 */
export const formatDateTimeWithTimezone = (
  timestamp,
  overrideTimezone = null
) => {
  if (!timestamp) return "";

  const { timezone, timeFormat } = getUserTimezonePreferences();
  const date = new Date(timestamp);

  return date.toLocaleString("en-US", {
    timeZone: overrideTimezone || timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12-hour",
    timeZoneName: "short",
  });
};

/**
 * Format date only (no time) with user's timezone
 * @param {Date|string|number} timestamp - The date to format
 * @param {string} overrideTimezone - Optional timezone to override user preference
 * @returns {string} Formatted date string (e.g., "September 1, 2025")
 */
export const formatDateOnly = (timestamp, overrideTimezone = null) => {
  if (!timestamp) return "";

  const { timezone } = getUserTimezonePreferences();
  const date = new Date(timestamp);

  return date.toLocaleDateString("en-US", {
    timeZone: overrideTimezone || timezone,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Format time only with user's timezone and format preference
 * @param {Date|string|number} timestamp - The date to format
 * @param {string} overrideTimezone - Optional timezone to override user preference
 * @returns {string} Formatted time string
 */
export const formatTimeOnly = (timestamp, overrideTimezone = null) => {
  if (!timestamp) return "";

  const { timezone, timeFormat } = getUserTimezonePreferences();
  const date = new Date(timestamp);

  return date.toLocaleTimeString("en-US", {
    timeZone: overrideTimezone || timezone,
    hour: timeFormat === "12-hour" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12-hour",
  });
};

/**
 * Format date in short format with user's timezone
 * @param {Date|string|number} timestamp - The date to format
 * @param {string} overrideTimezone - Optional timezone to override user preference
 * @returns {string} Formatted date string (e.g., "27 Sept 2025")
 */
export const formatDateShort = (timestamp, overrideTimezone = null) => {
  if (!timestamp) return "";

  const { timezone } = getUserTimezonePreferences();
  const date = new Date(timestamp);

  return date.toLocaleDateString("en-GB", {
    timeZone: overrideTimezone || timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const DateTimeDisplay = ({ timestamp, format }) => {
  if (!timestamp) return null;

  // Format the timestamp based on the specified format using common helper functions
  const getFormattedDate = (timestamp, format, overrideTimezone = null) => {
    switch (format) {
      case "date-only":
        // Sep 1, 2025
        return formatDateOnly(timestamp, overrideTimezone);

      case "date-time":
        // 01:51
        // 27 Sept 2025
        return (
          <div>
            <div className="fw-bold">
              {formatTimeOnly(timestamp, overrideTimezone)}
            </div>
            <div className="text-secondary small">
              {formatDateShort(timestamp, overrideTimezone)}
            </div>
          </div>
        );

      default:
        // Sep 08, 2025, 05:45 PM UTC
        return formatDateTimeWithTimezone(timestamp, overrideTimezone);
    }
  };

  const TimeDisplayComponent = () => (
    <span>{getFormattedDate(timestamp, format)}</span>
  );

  return (
    <Tooltip tooltip={getFormattedDate(timestamp, "", "UTC")}>
      <TimeDisplayComponent />
    </Tooltip>
  );
};

export default DateTimeDisplay;
