"use client";

import { useState, useEffect } from "react";
import { useDao } from "@/context/DaoContext";
import DropdownWithModal from "@/components/dropdowns/DropdownWithModal";

/**
 * Validator Dropdown with search and staking info
 * Used in CreateStakeRequest and CreateUnstakeRequest
 */
const ValidatorDropdown = ({
  options = [],
  selectedValidator,
  onSelect,
  disabled = false,
  showStakingInfo = false, // For unstake page to show staked amounts
  selectedWallet = null,
  isLoading = false,
}) => {
  const { lockupContract, daoStakedPools, lockupStakedPools } = useDao();
  const [validatorsWithDetails, setValidatorsWithDetails] = useState([]);

  // Get the correct staked pools based on selected wallet
  const stakedPools =
    selectedWallet === lockupContract ? lockupStakedPools : daoStakedPools;

  // Combine validator options with staking info (synchronous, no loading needed)
  useEffect(() => {
    if (!options || options.length === 0) {
      setValidatorsWithDetails([]);
      return;
    }

    // Options already include fee from the validators endpoint
    // Just need to add staking balances (this is instant, no loading needed)
    const enrichedValidators = options.map((option) => {
      // Find staked balances for this pool (for unstake page)
      const poolBalance = stakedPools?.find((p) => p.poolId === option.pool_id);

      return {
        ...option,
        fee: option.fee || "0", // Fee comes from validators endpoint
        isActive: true, // We can check this if needed, but for now assume active
        stakedBalance: poolBalance?.staked || 0,
        unstakedBalance: poolBalance?.unstaked || 0,
        availableToWithdrawBalance: poolBalance?.availableToWithdraw || 0,
      };
    });

    setValidatorsWithDetails(enrichedValidators);
  }, [options, stakedPools]);

  // Render validator option in modal
  const renderValidatorOption = (option) => {
    return (
      <div className="d-flex flex-column gap-1 w-100">
        <div className="h6 mb-0">{option.pool_id}</div>
        <div
          className="d-flex align-items-center gap-2"
          style={{ fontSize: 13 }}
        >
          <span className="text-secondary">{option.fee}% Fee</span>
        </div>

        {/* Show staking info only on unstake page */}
        {showStakingInfo && (
          <div className="d-flex flex-column gap-1">
            {option.stakedBalance > 0.01 && (
              <div
                className="d-flex align-items-center gap-1"
                style={{ fontSize: 13 }}
              >
                <span className="text-secondary">Staked:</span>
                <span className="text-warning">
                  {option.stakedBalance} NEAR
                </span>
              </div>
            )}
            {option.unstakedBalance > 0.01 && (
              <div
                className="d-flex align-items-center gap-1"
                style={{ fontSize: 13 }}
              >
                <span className="text-secondary">Pending release:</span>
                <span className="text-warning">
                  {option.unstakedBalance} NEAR
                </span>
              </div>
            )}
            {option.availableToWithdrawBalance > 0.01 && (
              <div
                className="d-flex align-items-center gap-1"
                style={{ fontSize: 13 }}
              >
                <span className="text-secondary">
                  Available for withdrawal:
                </span>
                <span className="text-warning">
                  {option.availableToWithdrawBalance} NEAR
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <DropdownWithModal
      modalTitle="Select Validator"
      options={validatorsWithDetails}
      onSelect={onSelect}
      renderOption={renderValidatorOption}
      dropdownLabel="Select a validator"
      selectedElement={
        selectedValidator ? <span>{selectedValidator.pool_id}</span> : null
      }
      searchPlaceholder="Search validators"
      enableSearch={true}
      disabled={disabled || isLoading}
      isLoading={isLoading}
      emptyMessage="No validators available"
      modalSize="lg"
      dataTestId="validator-dropdown"
    />
  );
};

export default ValidatorDropdown;
