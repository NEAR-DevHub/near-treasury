"use client";

import { useState } from "react";
import Profile from "@/components/ui/Profile";
import TokenIcon from "@/components/proposals/TokenIcon";
import HistoryStatus from "@/components/proposals/HistoryStatus";

// TODO: fix clicking on search loses focus on the input
// TODO: fix selecting one option from multiple options scrolls to top
// Filters dropdown with include/exclude and multiple filter types
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
  const [search, setSearch] = useState("");

  // Local UI state
  const [isMainDropdownOpen, setIsMainDropdownOpen] = useState(false);
  const [isIncludeDropdownOpen, setIsIncludeDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isAmountTypeDropdownOpen, setIsAmountTypeDropdownOpen] =
    useState(false);

  // Toggles
  const toggleMainDropdown = () => {
    setIsMainDropdownOpen((prev) => !prev);
  };

  const toggleIncludeDropdown = () => {
    setIsIncludeDropdownOpen((prev) => !prev);
  };

  const toggleTokenDropdown = () => {
    setIsTokenDropdownOpen((prev) => !prev);
  };

  const toggleAmountTypeDropdown = () => {
    setIsAmountTypeDropdownOpen((prev) => !prev);
  };

  const closeAllDropdowns = () => {
    setIsMainDropdownOpen(false);
    setIsIncludeDropdownOpen(false);
    setIsTokenDropdownOpen(false);
    setIsAmountTypeDropdownOpen(false);
  };

  const hideInclude = type === "vote" || type === "date";

  const statusOptions = ["Approved", "Rejected", "Failed", "Expired"];
  const voteOptions = [
    "Approved",
    "Rejected",
    isPendingRequests ? "Awaiting Decision" : "Not Voted",
  ];
  const includeOptions = [
    { value: true, label: multiple ? "is any" : "is" },
    { value: false, label: multiple ? "is not all" : "is not" },
  ];
  const amountOptions = [
    { label: "Is", value: "is" },
    { label: "Between", value: "between" },
    { label: "More than", value: ">" },
    { label: "Less than", value: "<" },
  ];

  const handleSelection = (item, e) => {
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
      closeAllDropdowns();
    }
  };

  const handleDateChange = (index, value) => {
    const newValues = [...selected];
    newValues[index] = value;
    setSelected(newValues);
  };

  const handleAmountTypeChange = (option) => {
    setAmountValues({
      min: "",
      max: "",
      equal: "",
      value: option.value,
    });
  };

  const handleAmountValueChange = (field, value) => {
    setAmountValues({
      ...amountValues,
      [field]: value,
    });
  };

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
                      amountOptions.find(
                        (option) => option.value === amountValues.value
                      )?.label
                    }
                    <i className="bi bi-chevron-down"></i>
                  </div>
                </button>
                {isAmountTypeDropdownOpen && (
                  <div className="dropdown-menu show">
                    {amountOptions.map((option) => (
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
          <div className="d-flex align-items-center gap-2">
            {amountValues.value === "between" ? (
              <div className="d-flex align-items-center gap-2">
                <div>
                  <label>From</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0"
                    value={amountValues.min}
                    onChange={(e) =>
                      handleAmountValueChange("min", e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <label>To</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0"
                    value={amountValues.max}
                    onChange={(e) =>
                      handleAmountValueChange("max", e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ) : (
              <input
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
        const filteredAccounts = (options || []).filter((account) =>
          (account || "")?.toLowerCase().includes(search.toLowerCase())
        );

        return (
          <div>
            <div className="position-relative px-3 py-2">
              <input
                type="text"
                className="form-control ps-5"
                placeholder="Search by account address"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: "14px" }}
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
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {filteredAccounts.map((account) => (
                <div
                  key={account}
                  className="d-flex align-items-center gap-2 dropdown-item cursor-pointer"
                  tabIndex={-1}
                  onMouseDown={(e) => handleSelection(account, e)}
                  style={{ padding: "8px 12px", outline: "none" }}
                >
                  <input
                    type="checkbox"
                    className="form-check-input"
                    role="switch"
                    checked={selected.includes(account)}
                    readOnly
                    style={{
                      minWidth: "18px",
                      minHeight: "18px",
                      pointerEvents: "none",
                    }}
                  />
                  <div className="text-truncate">
                    <Profile
                      accountId={account}
                      showKYC={false}
                      displayImage={true}
                      displayName={true}
                      profileClass="text-secondary"
                      displayHoverCard={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "token":
        const filteredTokens = options.filter((token) =>
          (token || "").toLowerCase().includes(search.toLowerCase())
        );

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
                  {filteredTokens.map((token) => (
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
        const filteredStatuses = statusOptions.filter((status) =>
          (status || "").toLowerCase().includes(search.toLowerCase())
        );

        return (
          <div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {filteredStatuses.map((status) => (
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
        const filteredVotes = voteOptions.filter((vote) =>
          (vote || "").toLowerCase().includes(search.toLowerCase())
        );

        return (
          <div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {filteredVotes.map((vote) => (
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
                  max={selected[1] || undefined}
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
        const filteredOptions = multiple
          ? (options || []).filter((option) =>
              (option || "")?.toLowerCase().includes(search.toLowerCase())
            )
          : options || [];

        return (
          <div>
            {multiple && (
              <div className="position-relative px-3 py-2">
                <input
                  type="text"
                  className="form-control ps-5"
                  placeholder="Search by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ fontSize: "14px" }}
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
            )}
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {filteredOptions.map((option) => (
                <div
                  key={option}
                  className="d-flex align-items-center gap-2 dropdown-item cursor-pointer"
                  tabIndex={-1}
                  onMouseDown={(e) => handleSelection(option, e)}
                  style={{ padding: "8px 12px", outline: "none" }}
                >
                  {multiple && (
                    <input
                      type="checkbox"
                      className="form-check-input"
                      role="switch"
                      checked={selected.includes(option)}
                      readOnly
                      style={{
                        minWidth: "18px",
                        minHeight: "18px",
                        pointerEvents: "none",
                      }}
                    />
                  )}
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

  const getAmountDisplay = () => {
    if (amountValues && amountValues.value) {
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
    }
    return "";
  };

  const getDisplayValue = () => {
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
      const amountDisplay = getAmountDisplay();
      if (amountDisplay) {
        return <TokenIcon address={selected[0]} number={amountDisplay} />;
      }

      return <TokenIcon address={selected[0]} />;
    } else if (type === "date") {
      if (selected[0] || selected[1]) {
        if (selected[0] && selected[1]) {
          return `${selected[0]} to ${selected[1]}`;
        } else if (selected[0]) {
          return `From ${selected[0]}`;
        } else if (selected[1]) {
          return `Until ${selected[1]}`;
        }
      }
      return "";
    } else if (type === "status") {
      return selected[0] === "Approved"
        ? isPaymentsPage
          ? "Funded"
          : "Executed"
        : selected[0];
    } else if (type === "type") {
      return selected[0];
    } else if (type === "amount") {
      const amountDisplay = getAmountDisplay();
      if (amountDisplay) {
        return <TokenIcon address="" number={amountDisplay} />;
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
  };

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
              <span>{getDisplayValue()}</span>
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
