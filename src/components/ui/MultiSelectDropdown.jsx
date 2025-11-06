"use client";

import { useMemo, useState, useCallback } from "react";

const MultiSelectDropdown = ({
  options = [],
  selected = [],
  onChange,
  placeholder = "Search...",
  renderOption,
  getOptionKey = (option) => option,
  getOptionLabel = (option) => option,
  filterOption = (option, searchTerm) =>
    getOptionLabel(option).toLowerCase().includes(searchTerm.toLowerCase()),
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Memoized: Filter and sort options (selected items at top)
  const sortedOptions = useMemo(() => {
    // Apply search filter
    let filtered = options;
    if (searchTerm.trim()) {
      filtered = options.filter((option) => filterOption(option, searchTerm));
    }

    // Sort: selected items first, then unselected
    const selectedKeys = new Set(selected.map((s) => getOptionKey(s)));
    const selectedItems = filtered.filter((option) =>
      selectedKeys.has(getOptionKey(option))
    );
    const unselectedItems = filtered.filter(
      (option) => !selectedKeys.has(getOptionKey(option))
    );

    return [...selectedItems, ...unselectedItems];
  }, [options, searchTerm, selected, filterOption, getOptionKey]);

  // Memoized: Check if option is selected
  const isSelected = useCallback(
    (option) => {
      const key = getOptionKey(option);
      return selected.some((s) => getOptionKey(s) === key);
    },
    [selected, getOptionKey]
  );

  // Optimized: Toggle selection
  const handleToggle = useCallback(
    (option) => {
      const key = getOptionKey(option);
      const isCurrentlySelected = selected.some((s) => getOptionKey(s) === key);

      const newSelected = isCurrentlySelected
        ? selected.filter((s) => getOptionKey(s) !== key)
        : [...selected, option];

      onChange(newSelected);
    },
    [selected, onChange, getOptionKey]
  );

  return (
    <div className="d-flex flex-column h-100">
      {/* Search Input */}
      <div className="position-relative px-3 py-2">
        <input
          type="text"
          className="form-control ps-5"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ fontSize: "14px" }}
          autoFocus
        />
        <i
          className="bi bi-search position-absolute text-secondary"
          style={{
            left: "25px",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Options List */}
      <div
        style={{
          maxHeight: "200px",
          overflowY: "auto",
          overflowAnchor: "none",
        }}
      >
        {sortedOptions.length === 0 ? (
          <div className="text-center text-secondary py-3">
            No results found
          </div>
        ) : (
          sortedOptions.map((option) => {
            const key = getOptionKey(option);
            const selected = isSelected(option);

            return (
              <div
                key={key}
                className="d-flex align-items-center gap-2 dropdown-item cursor-pointer"
                onClick={() => handleToggle(option)}
                style={{ padding: "8px 12px", outline: "none" }}
              >
                <input
                  type="checkbox"
                  className="form-check-input"
                  role="switch"
                  checked={selected}
                  readOnly
                  style={{
                    minWidth: "18px",
                    minHeight: "18px",
                    pointerEvents: "none",
                  }}
                />
                <div className="flex-grow-1">
                  {renderOption ? renderOption(option) : getOptionLabel(option)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MultiSelectDropdown;
