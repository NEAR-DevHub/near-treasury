"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import DropDown from "@/components/dropdowns/DropDown";
import DropdownWithModal from "@/components/dropdowns/DropdownWithModal";
import { logger } from "@/helpers/logger";
import { getTimezones } from "@/api/backend";
import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";

const timeFormats = [
  {
    label: "12-hour (1:00 PM)",
    value: "12-hour",
  },
  {
    label: "24-hour (13:00)",
    value: "24-hour",
  },
];

const Preferences = () => {
  const {
    watch,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm({
    defaultValues: {
      timeFormat: "12-hour",
      useLocation: false,
      timezone: null,
    },
  });

  const [timezones, setTimezones] = useState([]);
  const [showToast, setShowToast] = useState(false);

  // Watch form values
  const timeFormat = watch("timeFormat");
  const useLocation = watch("useLocation");
  const selectedTimezone = watch("timezone");

  // Load timezones from backend
  useEffect(() => {
    const fetchTimezones = async () => {
      try {
        const data = await getTimezones();
        setTimezones(data);
      } catch (error) {
        logger.error("Error fetching timezones:", error);
      }
    };
    fetchTimezones();
  }, []);

  // Load saved preferences from localStorage
  useEffect(() => {
    try {
      const storedPreferences = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_KEYS.USER_TIMEZONE_PREFERENCES) ||
          "{}"
      );

      // Build preferences object with loaded or default values
      const loadedPreferences = {
        timeFormat: storedPreferences.timeFormat || "12-hour",
        useLocation: storedPreferences.useLocation || false,
        timezone: storedPreferences.timezone || null,
      };

      // Reset form with loaded values to establish them as the baseline
      reset(loadedPreferences);
    } catch (error) {
      logger.error("Error loading preferences:", error);
    }
  }, [reset]);

  const detectUserTimezone = () => {
    try {
      const d = new Date();
      const offsetMinutes = d.getTimezoneOffset();

      // Convert offset to hours (offset is negative for positive timezones)
      const offsetHours = -offsetMinutes / 60;

      // Find timezone that matches this offset
      const matchingTimezone = timezones.find((tz) => {
        // Parse UTC offset from timezone string like "UTC-11:00"
        const utcMatch = tz.utc?.match(/UTC([+-]\d{1,2}):?(\d{2})?/);
        if (utcMatch) {
          const sign = utcMatch[1].charAt(0) === "+" ? 1 : -1;
          const hours = parseInt(utcMatch[1].substring(1));
          const minutes = utcMatch[2] ? parseInt(utcMatch[2]) : 0;
          const totalOffset = sign * (hours + minutes / 60);
          return Math.abs(totalOffset - offsetHours) < 0.1; // Allow small tolerance
        }
        return false;
      });

      if (matchingTimezone) {
        setValue("timezone", matchingTimezone, { shouldDirty: true });
      } else {
        // Fallback to UTC if no match found
        const utcTimezone =
          timezones.find((tz) => tz.name === "UTC") || timezones[0];
        if (utcTimezone) {
          setValue("timezone", utcTimezone, { shouldDirty: true });
        }
      }
    } catch (error) {
      logger.error("Failed to detect timezone:", error);
      // Fallback to UTC
      const utcTimezone =
        timezones.find((tz) => tz.name === "UTC") || timezones[0];
      if (utcTimezone) {
        setValue("timezone", utcTimezone, { shouldDirty: true });
      }
    }
  };

  // Auto-detect timezone when useLocation is enabled
  useEffect(() => {
    if (useLocation && !selectedTimezone && timezones.length > 0) {
      detectUserTimezone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLocation, timezones.length]);

  const handleUseLocationToggle = (checked) => {
    setValue("useLocation", checked, { shouldDirty: true });

    if (checked) {
      detectUserTimezone();
    }
  };

  const handleTimezoneSelect = (timezone) => {
    setValue("timezone", timezone, { shouldDirty: true });
  };

  const handleTimeFormatSelect = ({ value }) => {
    setValue("timeFormat", value, { shouldDirty: true });
  };

  const handleCancel = () => {
    // Reset form to last saved values
    reset();
  };

  const handleSaveChanges = () => {
    const newPreferences = {
      timezone: selectedTimezone,
      useLocation: useLocation,
      timeFormat: timeFormat,
    };

    // Save all preferences to storage
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.USER_TIMEZONE_PREFERENCES,
      JSON.stringify(newPreferences)
    );

    // Reset form state to mark as not dirty
    reset(newPreferences);

    // Show toast notification
    setShowToast(true);

    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  return (
    <div>
      <div className="card rounded-4 py-3" style={{ maxWidth: "50rem" }}>
        <div className="card-title px-3 pb-3">Preferences</div>
        <div className="px-3 py-1 d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <label className="form-label">Time Format</label>
            <DropDown
              options={timeFormats}
              selectedValue={
                timeFormats.find((f) => f.value === timeFormat) ||
                timeFormats[0]
              }
              onUpdate={handleTimeFormatSelect}
            />
          </div>

          <div className="d-flex align-items-center justify-content-between gap-2">
            <span className="text-color">
              Set timezone automatically using your location
            </span>
            <label className="form-switch cursor-pointer">
              <input
                type="checkbox"
                checked={useLocation}
                onChange={(e) => handleUseLocationToggle(e.target.checked)}
              />
              <i></i>
            </label>
          </div>

          <div>
            <label className="form-label">Timezone</label>
            <DropdownWithModal
              options={timezones}
              modalTitle="Select Timezone"
              dataTestId="select-timezone-dropdown"
              selectedElement={
                selectedTimezone ? (
                  <div className="d-flex align-items-center gap-2">
                    ({selectedTimezone.utc}) {selectedTimezone.value}
                  </div>
                ) : (
                  <span className="text-secondary">Select Timezone</span>
                )
              }
              modalSize="lg"
              dropdownLabel="Select Timezone"
              onSelect={handleTimezoneSelect}
              disabled={useLocation}
              enableSearch={true}
              searchPlaceholder="Search timezones"
              renderOption={(option) => (
                <div className="d-flex align-items-center gap-2">
                  ({option.utc}) {option.value}
                </div>
              )}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 align-items-center">
            <button
              className="btn btn-outline-secondary"
              onClick={handleCancel}
              disabled={!isDirty}
            >
              Cancel
            </button>
            <button
              className="btn theme-btn"
              onClick={handleSaveChanges}
              disabled={!isDirty}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="toast-container position-fixed bottom-0 end-0 p-3">
          <div className="toast show">
            <div className="toast-header px-2">
              <strong className="me-auto">Just Now</strong>
              <i
                className="bi bi-x-lg h6 mb-0 cursor-pointer"
                onClick={() => setShowToast(false)}
              ></i>
            </div>
            <div className="toast-body">
              <div className="d-flex align-items-center gap-3">
                <i className="bi bi-check2 mb-0 success-icon"></i>
                <div>
                  <div>Preferences saved successfully!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Preferences;
