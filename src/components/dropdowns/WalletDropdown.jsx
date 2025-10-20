"use client";

import { useState, useEffect, useMemo } from "react";
import { useDao } from "@/context/DaoContext";
import { deserializeLockupContract } from "@/helpers/nearHelpers";
import DropDown from "@/components/dropdowns/DropDown";

/**
 * WalletDropdown Component
 * Dropdown for selecting between SputnikDAO, Lockup, and Intents wallets
 *
 * @param {string} selectedValue - Currently selected wallet
 * @param {Function} onUpdate - Callback when wallet changes
 * @param {boolean} showIntents - Show NEAR Intents option
 * @param {boolean} isStakingDelegationPage - Check if lockup staking is allowed
 */
const WalletDropdown = ({
  selectedValue,
  onUpdate,
  showIntents = false,
  isStakingDelegationPage = false,
}) => {
  const {
    daoId: treasuryDaoID,
    lockupContract,
    lockupContractState,
  } = useDao();
  const [isLockupStakingAllowed, setLockupStakingAllowed] = useState(false);

  // Build wallet options based on available contracts
  const walletOptions = useMemo(() => {
    const baseOptions = [
      {
        label: "SputnikDAO",
        value: treasuryDaoID,
      },
    ];

    const additionalOptions = [];

    // Add lockup option if contract exists
    if (lockupContract) {
      additionalOptions.push({
        label: "Lockup",
        value: lockupContract,
      });
    }

    // Add intents option if showIntents is true
    if (showIntents) {
      additionalOptions.push({
        label: "NEAR Intents",
        value: "intents.near",
      });
    }

    return [...baseOptions, ...additionalOptions];
  }, [lockupContract, showIntents, treasuryDaoID]);

  // Check if lockup staking is allowed (for staking delegation page)
  useEffect(() => {
    if (isStakingDelegationPage && lockupContract && lockupContractState) {
      try {
        const deserialized = deserializeLockupContract(
          new Uint8Array([...lockupContractState].map((c) => c.charCodeAt(0)))
        );
        const stakingPoolId = deserialized.staking_pool_whitelist_account_id
          ? deserialized.staking_pool_whitelist_account_id.toString()
          : null;
        const isStakingNotAllowed =
          stakingPoolId === "lockup-no-whitelist.near";
        setLockupStakingAllowed(!isStakingNotAllowed);
      } catch (error) {
        console.error("Error checking lockup staking:", error);
        setLockupStakingAllowed(false);
      }
    } else if (!isStakingDelegationPage) {
      setLockupStakingAllowed(true);
    }
  }, [isStakingDelegationPage, lockupContract, lockupContractState]);

  // Don't show dropdown if on staking page and lockup staking not allowed
  if (!isLockupStakingAllowed && isStakingDelegationPage) {
    return null;
  }

  return (
    <div className="d-flex flex-column gap-1">
      <label>Treasury Wallet</label>
      <DropDown
        options={walletOptions}
        selectedValue={selectedValue}
        onUpdate={onUpdate}
        defaultLabel="Select Wallet"
        dataTestId="wallet-dropdown"
      />
    </div>
  );
};

export default WalletDropdown;
