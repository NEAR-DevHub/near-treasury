"use client";

import { useState, useEffect } from "react";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import {
  getProposalApprovers,
  getProposalValidators,
  getProposalProposers,
} from "@/api/indexer";
import FiltersDropdown from "@/components/dropdowns/FiltersDropdown";
import StakeIcon from "@/components/icons/StakeIcon";
import UnstakeIcon from "@/components/icons/UnstakeIcon";
import WithdrawIcon from "@/components/icons/WithdrawIcon";

const StakeDelegationFilters = ({
  activeFilters = {},
  setActiveFilters = () => {},
  isPendingRequests = false,
  amountValues = { min: "", max: "" },
  setAmountValues = () => {},
  setShowFilters = () => {},
}) => {
  const { daoId: treasuryDaoID } = useDao();
  const { accountId } = useNearWallet();

  const [availableFilters] = useState([
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
    {
      key: "type",
      label: "Type",
      type: "type",
      multiple: false,
    },
    {
      key: "amount",
      label: "Amount",
      type: "amount",
      multiple: false,
    },
    { key: "validators", label: "Validator", type: "options", multiple: true },
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
  ]);

  const [approverOptions, setApproverOptions] = useState([]);
  const [validatorOptions, setValidatorOptions] = useState([]);
  const [proposerOptions, setProposerOptions] = useState([]);

  useEffect(() => {
    if (treasuryDaoID) {
      // Fetch approvers
      getProposalApprovers(treasuryDaoID)
        .then((data) => setApproverOptions(data || []))
        .catch((error) => {
          console.error("Error fetching approvers:", error);
          setApproverOptions([]);
        });

      // Fetch validators
      getProposalValidators(treasuryDaoID)
        .then((data) => setValidatorOptions(data || []))
        .catch((error) => {
          console.error("Error fetching validators:", error);
          setValidatorOptions([]);
        });

      // Fetch proposers
      getProposalProposers(treasuryDaoID)
        .then((data) => setProposerOptions(data || []))
        .catch((error) => {
          console.error("Error fetching proposers:", error);
          setProposerOptions([]);
        });
    }
  }, [treasuryDaoID]);

  const getOptionsForFilter = (filterKey) => {
    const optionsMap = {
      approvers: approverOptions,
      validators: validatorOptions,
      proposers: proposerOptions,
      type: [
        { label: "Stake", Icon: StakeIcon },
        { label: "Unstake", Icon: UnstakeIcon },
        { label: "Withdraw", Icon: WithdrawIcon },
      ],
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
    setAmountValues({
      min: "",
      max: "",
      equal: "",
      value: "between",
    });
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
            isPaymentsPage={false}
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

export default StakeDelegationFilters;
