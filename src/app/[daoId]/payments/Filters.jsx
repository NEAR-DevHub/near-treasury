"use client";

import { useState, useEffect } from "react";
import { useDao } from "@/context/DaoContext";
import { accountToLockup } from "@/helpers/nearHelpers";
import { useNearWallet } from "@/context/NearWalletContext";
import {
  getProposalApprovers,
  getProposalRecipients,
  getProposalRequestedTokens,
  getProposalProposers,
} from "@/api/indexer";
import FiltersDropdown from "@/components/dropdowns/FiltersDropdown";

/**
 * Filters Component
 * Filter bar for payment proposals with dynamic filter options
 */
const Filters = ({
  activeFilters,
  setActiveFilters,
  isPendingRequests = false,
  amountValues,
  setAmountValues,
  setShowFilters,
}) => {
  const { daoId: treasuryDaoID, lockupContract } = useDao();
  const { accountId } = useNearWallet();

  const [approverOptions, setApproverOptions] = useState([]);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [tokenOptions, setTokenOptions] = useState([]);
  const [proposerOptions, setProposerOptions] = useState([]);

  // Available filters configuration
  const availableFilters = [
    ...(!isPendingRequests
      ? [
          {
            key: "created_date",
            label: "Created Date",
            type: "date",
            multiple: false,
          },
          {
            key: "status",
            label: "Status",
            type: "status",
            multiple: false,
          },
        ]
      : []),
    { key: "source", label: "Source Wallet", type: "options", multiple: false },
    { key: "recipients", label: "Recipient", type: "account", multiple: true },
    { key: "token", label: "Token", type: "token", multiple: false },
    { key: "proposers", label: "Created by", type: "account", multiple: true },
    { key: "approvers", label: "Approver", type: "account", multiple: true },
    ...(accountId
      ? [
          {
            key: "votes",
            label: "My Vote Status",
            type: "vote",
            multiple: false,
          },
        ]
      : []),
  ];

  // Fetch filter options from indexer
  useEffect(() => {
    if (treasuryDaoID) {
      getProposalApprovers(treasuryDaoID).then(setApproverOptions);
      getProposalRecipients(treasuryDaoID).then(setRecipientOptions);
      getProposalRequestedTokens(treasuryDaoID).then(setTokenOptions);
      getProposalProposers(treasuryDaoID).then(setProposerOptions);
    }
  }, [treasuryDaoID]);

  const getOptionsForFilter = (filterKey) => {
    const optionsMap = {
      approvers: approverOptions,
      recipients: recipientOptions,
      token: tokenOptions,
      proposers: proposerOptions,
      source: lockupContract
        ? ["SputnikDAO", "Intents", "Lockup"]
        : ["SputnikDAO", "Intents"],
    };
    return optionsMap[filterKey] || [];
  };

  const addFilter = (filterKey) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterKey]: {
        include: true,
        values: [],
      },
    }));
  };

  const removeFilter = (filterKey) => {
    setActiveFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];
      return newFilters;
    });
  };

  const updateFilterInclude = (filterKey, include) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterKey]: {
        ...prev[filterKey],
        include,
      },
    }));
  };

  const handleFilterSelection = (filterKey, selectedValues, include) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterKey]: {
        include: include !== undefined ? include : prev[filterKey]?.include,
        values: selectedValues,
      },
    }));
  };

  const clearAllFilters = () => {
    setShowFilters(false);
    setActiveFilters({});
  };

  const getFilterLabel = (key) => {
    return availableFilters.find((f) => f.key === key)?.label || key;
  };

  const getFilterType = (key) => {
    return availableFilters.find((f) => f.key === key)?.type || "text";
  };

  const getFilterMultiple = (key) => {
    return availableFilters.find((f) => f.key === key)?.multiple || false;
  };

  const availableFiltersToAdd = availableFilters.filter(
    (filter) => !activeFilters[filter.key]
  );

  return (
    <div
      className="d-flex align-items-center p-3 flex-wrap"
      style={{ gap: "12px" }}
    >
      {/* Clear All Button */}
      <button
        className="btn btn-sm btn-outline-secondary"
        onClick={clearAllFilters}
      >
        <i className="bi bi-x-lg"></i>
      </button>

      {/* Separator */}
      {Object.entries(activeFilters).length > 0 && (
        <div
          style={{
            height: "42px",
            marginBlock: "auto",
            minWidth: "1px",
            backgroundColor: "var(--border-color)",
          }}
        />
      )}

      {/* Active Filters */}
      {Object.entries(activeFilters).map(([filterKey, filterData]) => (
        <div key={filterKey} className="d-flex gap-2">
          <FiltersDropdown
            label={getFilterLabel(filterKey)}
            type={getFilterType(filterKey)}
            selected={filterData.values || []}
            include={filterData.include}
            setSelected={(values) => handleFilterSelection(filterKey, values)}
            onIncludeChange={(include) =>
              updateFilterInclude(filterKey, include)
            }
            options={getOptionsForFilter(filterKey)}
            multiple={getFilterMultiple(filterKey)}
            setAmountValues={setAmountValues}
            amountValues={amountValues}
            removeFilter={() => removeFilter(filterKey)}
            isPendingRequests={isPendingRequests}
            isPaymentsPage={true}
          />
        </div>
      ))}

      {/* Add Filter Dropdown */}
      {availableFiltersToAdd.length > 0 && (
        <div className="dropdown">
          <button
            className="btn btn-outline-secondary"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="bi bi-plus-lg"></i> Add Filter
          </button>
          <ul className="dropdown-menu">
            {availableFiltersToAdd.map((filter) => (
              <li key={filter.key}>
                <button
                  className="dropdown-item"
                  onClick={() => addFilter(filter.key)}
                >
                  {filter.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Filters;
