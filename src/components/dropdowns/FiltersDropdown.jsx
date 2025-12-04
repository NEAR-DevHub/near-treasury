"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import Profile from "@/components/ui/Profile";
import TokenIcon from "@/components/proposals/TokenIcon";
import HistoryStatus from "@/components/proposals/HistoryStatus";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";

// Static constants (moved outside component to prevent recreation)
const STATUS_OPTIONS = ["Approved", "Rejected", "Failed", "Expired"];
const AMOUNT_OPTIONS = [
  { label: "Is", value: "is" },
  { label: "Between", value: "between" },
  { label: "More than", value: ">" },
  { label: "Less than", value: "<" },
];

const FiltersDropdown = ({
  label,
  options = [],
  setSelected,
  selected = [],
  type,
  onIncludeChange,
  multiple = false,
  setAmountValues,
  amountValues,
  removeFilter,
  include = true,
  isPendingRequests = false,
  isPaymentsPage = false,
}) => {
  const [isMainDropdownOpen, setIsMainDropdownOpen] = useState(false);
  const [isIncludeDropdownOpen, setIsIncludeDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isAmountTypeDropdownOpen, setIsAmountTypeDropdownOpen] =
    useState(false);

  const amountInputRefs = useRef({});

  // Memoized computed values
  const hideInclude = useMemo(() => type === "vote" || type === "date", [type]);

  const voteOptions = useMemo(
    () => [
      "Approved",
      "Rejected",
      isPendingRequests ? "Awaiting Decision" : "Not Voted",
    ],
    [isPendingRequests]
  );

  const includeOptions = useMemo(
    () => [
      { value: true, label: multiple ? "is any" : "is" },
      { value: false, label: multiple ? "is not all" : "is not" },
    ],
    [multiple]
  );

  // Memoized toggle functions
  const toggleMainDropdown = useCallback(() => {
    setIsMainDropdownOpen((prev) => !prev);
  }, []);

  const toggleIncludeDropdown = useCallback(() => {
    setIsIncludeDropdownOpen((prev) => !prev);
  }, []);

  const toggleTokenDropdown = useCallback(() => {
    setIsTokenDropdownOpen((prev) => !prev);
  }, []);

  const toggleAmountTypeDropdown = useCallback(() => {
    setIsAmountTypeDropdownOpen((prev) => !prev);
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setIsMainDropdownOpen(false);
    setIsIncludeDropdownOpen(false);
    setIsTokenDropdownOpen(false);
    setIsAmountTypeDropdownOpen(false);
  }, []);

  // Memoized handlers
  const handleSelection = useCallback(
    (item, e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (multiple) {
        const newValues = selected.includes(item)
          ? selected.filter((v) => v !== item)
          : [...selected, item];
        setSelected(newValues);
      } else {
        setSelected(selected.includes(item) ? [] : [item]);
        // Don't close main dropdown if it's token/amount type (user needs to enter amount)
        if (type !== "token" && type !== "amount") {
          closeAllDropdowns();
        }
      }
    },
    [multiple, selected, setSelected, closeAllDropdowns, type]
  );

  const handleDateChange = useCallback(
    (index, value) => {
      const newValues = [...selected];
      newValues[index] = value;
      setSelected(newValues);
    },
    [selected, setSelected]
  );

  const handleAmountTypeChange = useCallback(
    (option) => {
      setAmountValues({
        min: "",
        max: "",
        equal: "",
        value: option.value,
      });
      setIsAmountTypeDropdownOpen(false); // Close dropdown after selection
    },
    [setAmountValues]
  );

  const handleAmountValueChange = useCallback(
    (field, value) => {
      const activeElement = document.activeElement;
      const focusedInputName = activeElement?.name;

      setAmountValues({
        ...amountValues,
        [field]: value,
      });

      if (focusedInputName) {
        requestAnimationFrame(() => {
          const inputToFocus = amountInputRefs.current[focusedInputName];
          if (inputToFocus && document.activeElement !== inputToFocus) {
            inputToFocus.focus();
            const len = inputToFocus.value.length;
            inputToFocus.setSelectionRange(len, len);
          }
        });
      }
    },
    [amountValues, setAmountValues]
  );

  const AmountOptions = ({ showDelete }) => {
    return (
      <div className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <div
              className="text-secondary"
              style={{ fontSize: showDelete ? "14px" : "12px" }}
            >
              Amount
            </div>
            <div>
              <div className="dropdown">
                <button
                  className="btn btn-sm btn-outline-secondary dropdown-toggle border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAmountTypeDropdown();
                  }}
                >
                  <div className="d-flex align-items-center gap-1">
                    {
                      AMOUNT_OPTIONS.find(
                        (option) => option.value === amountValues.value
                      )?.label
                    }
                    <i className="bi bi-chevron-down"></i>
                  </div>
                </button>
                {isAmountTypeDropdownOpen && (
                  <div className="dropdown-menu show">
                    {AMOUNT_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className="dropdown-item cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAmountTypeChange(option);
                        }}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {showDelete && (
            <div
              className="text-danger cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                removeFilter();
              }}
            >
              <i className="bi bi-trash"></i>
            </div>
          )}
        </div>

        {amountValues.value && (
          <div className="d-flex align-items-center gap-2 mt-2">
            {amountValues.value === "between" ? (
              <div className="d-flex align-items-center gap-2">
                <div>
                  <label className="form-label mb-1 text-sm">From</label>
                  <input
                    ref={(el) => (amountInputRefs.current["amount-min"] = el)}
                    name="amount-min"
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0"
                    min="0"
                    max={amountValues.max || undefined}
                    value={amountValues.min}
                    onChange={(e) =>
                      handleAmountValueChange("min", e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <label className="form-label mb-1 text-sm">To</label>
                  <input
                    ref={(el) => (amountInputRefs.current["amount-max"] = el)}
                    name="amount-max"
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0"
                    min={amountValues.min || "0"}
                    value={amountValues.max}
                    onChange={(e) =>
                      handleAmountValueChange("max", e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ) : (
              <input
                ref={(el) => {
                  const field =
                    amountValues.value === ">"
                      ? "amount-min"
                      : amountValues.value === "<"
                        ? "amount-max"
                        : "amount-equal";
                  amountInputRefs.current[field] = el;
                }}
                name={
                  amountValues.value === ">"
                    ? "amount-min"
                    : amountValues.value === "<"
                      ? "amount-max"
                      : "amount-equal"
                }
                type="number"
                className="form-control form-control-sm"
                placeholder="0"
                value={
                  amountValues.value === ">"
                    ? amountValues.min
                    : amountValues.value === "<"
                      ? amountValues.max
                      : amountValues.equal
                }
                onChange={(e) => {
                  const field =
                    amountValues.value === ">"
                      ? "min"
                      : amountValues.value === "<"
                        ? "max"
                        : "equal";
                  handleAmountValueChange(field, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  // Render different filter types
  const OptionRender = () => {
    switch (type) {
      case "account":
        return (
          <MultiSelectDropdown
            options={options}
            selected={selected}
            onChange={setSelected}
            placeholder="Search by account address"
            getOptionKey={(account) => account}
            getOptionLabel={(account) => account}
            renderOption={(account) => (
              <Profile
                accountId={account}
                showKYC={false}
                displayImage={true}
                displayName={true}
                displayAddress={true}
                imageSize={{ width: 30, height: 30 }}
              />
            )}
          />
        );

      case "token":
        return (
          <div
            className="pb-2 d-flex flex-column gap-2 px-3 pt-1"
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              setTimeout(() => setIsTokenDropdownOpen(false), 200);
            }}
          >
            <div className="dropdown w-100">
              <button
                className="btn btn-sm btn-outline-secondary dropdown-toggle w-100 text-start d-flex align-items-center justify-content-between"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTokenDropdown();
                }}
              >
                <div className="d-flex align-items-center">
                  {selected.length > 0 ? (
                    <div style={{ width: "fit-content" }}>
                      <TokenIcon address={selected[0]} />
                    </div>
                  ) : (
                    "Select Token"
                  )}
                </div>
                <i className="bi bi-chevron-down"></i>
              </button>
              {isTokenDropdownOpen && (
                <div
                  className="dropdown-menu show w-100"
                  style={{ maxHeight: "200px", overflowY: "auto" }}
                >
                  {options.map((token) => (
                    <div
                      key={token}
                      className="dropdown-item cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelection(token, e);
                        setIsTokenDropdownOpen(false);
                      }}
                    >
                      <div style={{ width: "fit-content" }}>
                        <TokenIcon address={token} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.length > 0 && include && <AmountOptions />}
          </div>
        );

      case "status":
        return (
          <div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {STATUS_OPTIONS.map((status) => (
                <div
                  key={status}
                  className="dropdown-item"
                  onClick={(e) => handleSelection(status, e)}
                >
                  <div style={{ width: "fit-content" }}>
                    <HistoryStatus
                      isVoteStatus={false}
                      status={status}
                      isPaymentsPage={isPaymentsPage}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "vote":
        return (
          <div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {voteOptions.map((vote) => (
                <div
                  key={vote}
                  className="d-flex align-items-center gap-2 dropdown-item"
                  onClick={(e) => handleSelection(vote, e)}
                >
                  <span>{vote}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "date":
        return (
          <div className="d-flex flex-column gap-2 px-2 pb-3">
            <div className="d-flex align-items-center gap-2">
              <div>
                <label
                  className="text-secondary"
                  style={{ fontSize: "12px", marginBottom: "5px" }}
                >
                  From Date
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={selected[0] || ""}
                  max={selected[1] || new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleDateChange(0, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label
                  className="text-secondary"
                  style={{ fontSize: "12px", marginBottom: "5px" }}
                >
                  To Date
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  min={selected[0] || undefined}
                  max={new Date().toISOString().split("T")[0]}
                  value={selected[1] || ""}
                  onChange={(e) => handleDateChange(1, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        );

      case "type":
        return (
          <div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {options.map(({ label, Icon }) => (
                <div
                  key={label}
                  className="dropdown-item cursor-pointer"
                  onClick={(e) => handleSelection(label, e)}
                  style={{ padding: "8px 12px" }}
                >
                  <div className="d-flex align-items-center gap-2">
                    {Icon && <Icon />}
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "options":
        if (multiple) {
          return (
            <MultiSelectDropdown
              options={options}
              selected={selected}
              onChange={setSelected}
              placeholder="Search by name"
              getOptionKey={(option) => option}
              getOptionLabel={(option) => option}
            />
          );
        }

        // Single select (no search)
        return (
          <div>
            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                overflowAnchor: "none",
              }}
            >
              {options.map((option) => (
                <div
                  key={option}
                  className="d-flex align-items-center gap-2 dropdown-item cursor-pointer"
                  tabIndex={-1}
                  onMouseDown={(e) => handleSelection(option, e)}
                  style={{ padding: "8px 12px", outline: "none" }}
                >
                  <div className="text-truncate">
                    <span>{option}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "amount":
        return (
          <div className="p-2">
            <AmountOptions showDelete={true} />
          </div>
        );

      default:
        return (
          <div className="p-2">
            <span>No options available for this filter type</span>
          </div>
        );
    }
  };

  // Memoized amount display
  const getAmountDisplay = useMemo(() => {
    if (!amountValues?.value) return "";

    if (
      amountValues.value === "between" &&
      amountValues.min &&
      amountValues.max
    ) {
      return `${amountValues.min}-${amountValues.max}`;
    } else if (amountValues.value === ">" && amountValues.min) {
      return `> ${amountValues.min}`;
    } else if (amountValues.value === "<" && amountValues.max) {
      return `< ${amountValues.max}`;
    } else if (amountValues.value === "is" && amountValues.equal) {
      return `${amountValues.equal}`;
    }

    return "";
  }, [amountValues]);

  // Memoized display value
  const getDisplayValue = useMemo(() => {
    if (type === "account") {
      return (
        <div className="d-flex align-items-center">
          {selected.map((accountId, index) => (
            <div
              key={accountId}
              style={{ marginLeft: index > 0 ? "-15px" : "0px" }}
            >
              <Profile
                accountId={accountId}
                showKYC={false}
                displayImage={true}
                displayName={false}
                displayAddress={false}
                imageSize={{ width: 30, height: 30 }}
              />
            </div>
          ))}
        </div>
      );
    } else if (type === "token") {
      if (getAmountDisplay) {
        return <TokenIcon address={selected[0]} number={getAmountDisplay} />;
      }
      return <TokenIcon address={selected[0]} />;
    } else if (type === "date") {
      // Format date using user's locale settings (numeric format to match date picker)
      const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString();
      };

      if (selected[0] || selected[1]) {
        if (selected[0] && selected[1]) {
          return `${formatDate(selected[0])} - ${formatDate(selected[1])}`;
        } else if (selected[0]) {
          return `From ${formatDate(selected[0])}`;
        } else if (selected[1]) {
          return `Until ${formatDate(selected[1])}`;
        }
      }
      return "";
    } else if (type === "status") {
      return selected[0];
    } else if (type === "type") {
      return selected[0];
    } else if (type === "amount") {
      if (getAmountDisplay) {
        return <TokenIcon address="" number={getAmountDisplay} />;
      }
      return "";
    } else if (type === "options") {
      if (selected.length === 1) {
        return selected[0];
      } else if (selected.length > 1) {
        return `${selected[0]}, ...`;
      }
      return "";
    } else {
      return selected.join(", ");
    }
  }, [type, selected, getAmountDisplay]);

  return (
    <div
      className="dropdown position-relative"
      style={{ fontSize: "14px" }}
      data-filters-dropdown
    >
      <button
        className="btn btn-outline-secondary d-flex align-items-center gap-2 justify-content-between"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleMainDropdown();
        }}
        style={{ backgroundColor: "var(--grey-05)" }}
      >
        <div className="d-flex align-items-center gap-2 text-start">
          <span className="text-secondary">{label}</span>
          {(selected.length > 0 || type === "amount") && (
            <div className="d-flex align-items-center gap-2 text-start">
              {!include && (
                <span
                  style={{
                    display: hideInclude ? "none" : "inline",
                  }}
                >
                  {includeOptions[1]?.label}
                </span>
              )}
              <span className="text-secondary">:</span>
              <span>{getDisplayValue}</span>
            </div>
          )}
        </div>
        <i className="bi bi-chevron-down"></i>
      </button>

      {isMainDropdownOpen && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ zIndex: 1040 }}
            onClick={closeAllDropdowns}
          />
          <div
            className="dropdown-menu rounded-2 dropdown-menu-start shadow w-100 p-0 show"
            style={{
              maxWidth: "320px",
              minWidth: "320px",
              position: "absolute",
              zIndex: 1050,
            }}
          >
            {type !== "amount" && (
              <div
                className="d-flex align-items-center gap-1"
                style={{ padding: hideInclude ? "8px 12px" : "4px 12px" }}
              >
                <span className="text-secondary" style={{ fontSize: "14px" }}>
                  {label}
                </span>
                <div className="dropdown position-relative">
                  <div
                    className="btn btn-sm btn-outline-secondary border-0 d-flex align-items-center gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleIncludeDropdown();
                    }}
                    style={{
                      display: hideInclude ? "none" : "flex",
                    }}
                  >
                    {
                      includeOptions.find((option) => option.value === include)
                        ?.label
                    }
                    <i className="bi bi-chevron-down"></i>
                  </div>
                  {isIncludeDropdownOpen && (
                    <ul
                      className="dropdown-menu show"
                      style={{
                        position: "absolute",
                        zIndex: 1050,
                      }}
                    >
                      {includeOptions.map((option) => (
                        <li key={option.value}>
                          <button
                            className={`dropdown-item ${
                              include === option.value ? "active" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onIncludeChange(option.value);
                              setIsIncludeDropdownOpen(false); // Close when option is clicked
                            }}
                          >
                            {option.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="ms-auto d-flex align-items-center gap-2">
                  {multiple && selected.length > 0 && (
                    <div
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected([]);
                      }}
                      style={{ fontSize: "14px" }}
                    >
                      Clear
                    </div>
                  )}
                  <div
                    className="text-danger cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFilter();
                    }}
                  >
                    <i className="bi bi-trash"></i>
                  </div>
                </div>
              </div>
            )}
            <OptionRender />
          </div>
        </>
      )}
    </div>
  );
};

export default FiltersDropdown;
