"use client";

import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";
import Tooltip from "./Tooltip";

const DateTimeDisplay = ({ timestamp, format }) => {
  if (!timestamp) return null;

  // Format the timestamp based on the specified format
  const getFormattedDate = (timestamp, format, timezone) => {
    const preferences = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.USER_TIMEZONE_PREFERENCES) || "{}"
    );
    const userTimezone = timezone || preferences.timezone?.name || "UTC";
    const timeFormat = preferences.timeFormat || "24-hour";
    const date = new Date(timestamp);

    // Base options for all formats
    const baseOptions = {
      timeZone: userTimezone,
    };

    // Time format options
    const timeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      ...baseOptions,
    };

    if (timeFormat === "12-hour") {
      timeFormatOptions.hour = "numeric";
      timeFormatOptions.hour12 = true;
    } else {
      timeFormatOptions.hour = "2-digit";
      timeFormatOptions.hour12 = false;
    }

    switch (format) {
      case "date-only":
        // Sep 1, 2025
        return date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          ...baseOptions,
        });

      case "date-time":
        // 01:51
        // 27 Sept 2025
        const dateOptions = {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...baseOptions,
        };

        const timeString = date.toLocaleTimeString("en-US", timeFormatOptions);
        const dateString = date.toLocaleDateString("en-GB", dateOptions);

        return (
          <div>
            <div className="fw-bold">{timeString}</div>
            <div className="text-secondary small">{dateString}</div>
          </div>
        );

      default:
        // Sep 08, 2025, 05:45 PM UTC
        return date.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZoneName: "short",
          ...timeFormatOptions,
        });
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
