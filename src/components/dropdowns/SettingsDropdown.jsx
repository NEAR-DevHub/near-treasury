"use client";

import { useState, useEffect } from "react";
import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";

const STORAGE_KEY = LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY;

const SettingsDropdown = ({ page, isPendingPage = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Define default columns for each page
  const getDefaultColumns = () => {
    switch (page) {
      case "payments":
        return [
          { title: "Created Date", show: true },
          { title: "Reference", show: true },
          { title: "Title", show: true },
          { title: "Summary", show: false },
          { title: "Recipient", show: true },
          { title: "Requested Token", show: false },
          { title: "Funding Ask", show: true },
          { title: "Creator", show: true },
          { title: "Notes", show: true },
          { title: "Required Votes", show: true },
          { title: "Votes", show: true },
          { title: "Approvers", show: true },
          { title: "Expiring Date", show: true },
        ];
      case "stake-delegation":
        return [
          { title: "Created Date", show: true },
          { title: "Type", show: true },
          { title: "Validator", show: true },
          { title: "Amount", show: true },
          { title: "Creator", show: true },
          { title: "Notes", show: true },
          { title: "Required Votes", show: true },
          { title: "Votes", show: true },
          { title: "Approvers", show: true },
          { title: "Expiring Date", show: true },
        ];
      case "asset-exchange":
        return [
          { title: "Created Date", show: true },
          { title: "From Token", show: true },
          { title: "To Token", show: true },
          { title: "Amount", show: true },
          { title: "Creator", show: true },
          { title: "Notes", show: true },
          { title: "Required Votes", show: true },
          { title: "Votes", show: true },
          { title: "Approvers", show: true },
          { title: "Expiring Date", show: true },
        ];
      case "function-call":
        return [
          { title: "Created Date", show: true },
          { title: "Notes", show: true },
          { title: "Creator", show: true },
          { title: "Required Votes", show: true },
          { title: "Votes", show: true },
          { title: "Approvers", show: true },
          { title: "Expiring Date", show: true },
        ];
      default:
        return [];
    }
  };

  // Load columns visibility from localStorage
  const loadColumnsVisibility = () => {
    if (typeof window === "undefined") return getDefaultColumns();

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return getDefaultColumns();

      const allSettings = JSON.parse(stored);
      return allSettings[page] || getDefaultColumns();
    } catch (error) {
      console.error("Error loading columns visibility:", error);
      return getDefaultColumns();
    }
  };

  // Save columns visibility to localStorage
  const saveColumnsVisibility = (columns) => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allSettings = stored ? JSON.parse(stored) : {};
      allSettings[page] = columns;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));

      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event("columnsVisibilityChanged"));
    } catch (error) {
      console.error("Error saving columns visibility:", error);
    }
  };

  const [settingsOptions, setSettingsOptions] = useState(
    loadColumnsVisibility()
  );

  // Reload when page changes
  useEffect(() => {
    setSettingsOptions(loadColumnsVisibility());
  }, [page]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option) => {
    const newOptions = [...settingsOptions];
    const index = newOptions.findIndex((i) => i.title === option.title);
    newOptions[index].show = !newOptions[index].show;
    setSettingsOptions(newOptions);
    saveColumnsVisibility(newOptions);
  };

  const Item = ({ option }) => {
    return (
      <div
        className="d-flex align-items-center w-100 justify-content-between"
        style={{ opacity: option.show ? "1" : "0.3" }}
      >
        <div className="h6 mb-0">{option.title}</div>
        <div>
          <i className="bi bi-eye h5 mb-0"></i>
        </div>
      </div>
    );
  };

  return (
    <div className="custom-select" tabIndex="0" onBlur={() => setIsOpen(false)}>
      <div
        className="dropdown-toggle btn btn-outline-secondary"
        onClick={toggleDropdown}
      >
        <i className="bi bi-gear h5 mb-0"></i>
      </div>

      {isOpen && (
        <div className="dropdown-menu rounded-2 dropdown-menu-end dropdown-menu-lg-start px-2 shadow show w-100">
          <div>
            <div className="text-secondary text-sm">Shown in table</div>
            {settingsOptions.map((option) => {
              // Hide pending-only columns in history view
              if (
                !isPendingPage &&
                (option.title === "Expiring Date" ||
                  option.title === "Required Votes" ||
                  option.title === "Votes")
              ) {
                return null;
              }

              return (
                <div
                  key={option.title}
                  className="dropdown-item cursor-pointer w-100 my-1"
                  onClick={() => handleOptionClick(option)}
                >
                  <Item option={option} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown;
