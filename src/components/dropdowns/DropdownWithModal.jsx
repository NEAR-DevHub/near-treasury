"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/ui/Modal";

/**
 * Optimized Dropdown with Modal Component
 * Opens a modal for selection instead of inline dropdown
 * Supports both local and API-based search
 *
 * @param {string} modalTitle - Title shown in modal header
 * @param {Array} options - Array of options to display
 * @param {Function} onSelect - Callback when option is selected
 * @param {Function} renderOption - Function to render each option (optional)
 * @param {string} dropdownLabel - Label shown in dropdown button
 * @param {ReactNode} selectedElement - Custom element to show when selected
 * @param {string} searchPlaceholder - Placeholder for search input
 * @param {boolean} enableSearch - Enable search functionality
 * @param {boolean} disabled - Disable the dropdown
 * @param {string} dataTestId - Test ID for the dropdown
 * @param {boolean} isLoading - Show loading state
 * @param {string} emptyMessage - Message when no options available
 * @param {Function} onSearch - Callback for API search (if provided, uses API instead of local search)
 * @param {number} searchDebounceMs - Debounce delay for API search in milliseconds (default: 500)
 */
const DropdownWithModal = ({
  modalTitle = "Select an option",
  options = [],
  onSelect,
  renderOption,
  dropdownLabel = "Select",
  selectedElement,
  searchPlaceholder = "Search...",
  enableSearch = false,
  disabled = false,
  dataTestId,
  isLoading = false,
  emptyMessage = "No options available",
  onSearch = null, // If provided, uses API search instead of local
  searchDebounceMs = 500,
  modalSize = "md",
}) => {
  console.log({ options });
  const [showModal, setShowModal] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchDebounceTimeout, setSearchDebounceTimeout] = useState(null);

  // Handle search with debounce for API calls
  const handleSearchChange = (value) => {
    setSearchValue(value);

    // If onSearch callback is provided, use API search
    if (onSearch && typeof onSearch === "function") {
      // Clear previous timeout
      if (searchDebounceTimeout) {
        clearTimeout(searchDebounceTimeout);
      }

      // Set new timeout for debounced API call
      const timeoutId = setTimeout(() => {
        onSearch(value);
      }, searchDebounceMs);

      setSearchDebounceTimeout(timeoutId);
    }
  };

  // Memoized filtered options for LOCAL search only
  const filteredOptions = useMemo(() => {
    // If API search is enabled (onSearch provided), don't filter locally
    if (onSearch) {
      return options;
    }

    // Local search: filter options when no API search
    if (!enableSearch || !searchValue) {
      return options;
    }

    const searchLower = searchValue.toLowerCase();

    return options.filter((option) => {
      // Handle object options
      if (typeof option === "object" && option !== null) {
        const searchableFields = [
          option.title,
          option.pool_id,
          option.name,
          option.label,
          option.id,
          option.value,
          option.asset_name,  // For asset search (e.g., "USDC")
          option.symbol,      // For token symbol search
        ]
          .filter(Boolean)  // Remove null/undefined
          .map(field => field.toString().toLowerCase())
          .join(' ');
        return searchableFields.includes(searchLower);
      }

      // Handle string options
      return option.toString().toLowerCase().includes(searchLower);
    });
  }, [options, searchValue, enableSearch, onSearch]);

  // Reset search when modal closes
  useEffect(() => {
    if (!showModal) {
      setSearchValue("");
    }
  }, [showModal]);

  // Default render function if none provided
  const defaultRenderOption = (option) => {
    if (typeof option === "object" && option !== null) {
      return (
        <div className="d-flex align-items-center gap-2">
          {option.icon && (
            <img
              src={option.icon}
              alt=""
              className="rounded-circle"
              style={{ width: "24px", height: "24px", objectFit: "cover" }}
            />
          )}
          <span>{option.label || option.name || option.value}</span>
        </div>
      );
    }
    return <span>{option}</span>;
  };

  const handleSelect = (option) => {
    onSelect(option);
    setShowModal(false);
  };

  return (
    <>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        className={`d-flex align-items-center justify-content-between bg-dropdown border rounded-2 btn w-100 ${
          disabled ? "opacity-50" : ""
        }`}
        onClick={() => !disabled && setShowModal(true)}
        disabled={disabled}
        data-testid={dataTestId}
      >
        <div className="d-flex align-items-center gap-2">
          {selectedElement || (
            <span className="text-secondary">{dropdownLabel}</span>
          )}
        </div>
        <i className="bi bi-chevron-down"></i>
      </button>

      {/* Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          heading={modalTitle}
          onClose={() => setShowModal(false)}
          size={modalSize}
        >
          <div className="d-flex flex-column gap-3">
            {/* Search Input */}
            {enableSearch && (
              <div className="position-relative">
                <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary"></i>
                <input
                  type="text"
                  className="form-control ps-5"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Options List */}
            <div
              className="d-flex flex-column gap-1"
              style={{
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {isLoading ? (
                <div className="text-center py-4">
                  <div
                    className="spinner-border spinner-border-sm"
                    role="status"
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="text-center py-4 text-secondary">
                  {options.length === 0 ? emptyMessage : "No results found"}
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <div
                    key={option?.value || option?.id || index}
                    className="dropdown-item cursor-pointer p-2 rounded"
                    onClick={() => handleSelect(option)}
                    style={{ cursor: "pointer" }}
                  >
                    {renderOption
                      ? renderOption(option)
                      : defaultRenderOption(option)}
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default DropdownWithModal;
