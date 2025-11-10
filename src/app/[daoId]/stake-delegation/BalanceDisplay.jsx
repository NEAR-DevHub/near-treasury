"use client";

import { useMemo } from "react";
import Tooltip from "@/components/ui/Tooltip";
import { useDao } from "@/context/DaoContext";
import { TOOLTIP_TEXT } from "@/constants/ui";
import {
  formatNearAmount,
  LOCKUP_MIN_BALANCE_FOR_STORAGE,
} from "@/helpers/nearHelpers";

/**
 * Reusable balance display component for stake delegation
 * Shows: Ready to stake, Staked, Pending release, Available for withdrawal
 */
const BalanceDisplay = ({ selectedWallet }) => {
  const {
    lockupContract,
    daoNearBalances,
    lockupNearBalances,
    daoStakedBalances,
    lockupStakedBalances,
  } = useDao();

  // Calculate balances based on selected wallet
  const balances = useMemo(() => {
    if (selectedWallet?.value === lockupContract) {
      const total = lockupNearBalances?.totalParsed || 0;
      const staked = lockupStakedBalances?.total || 0;
      const available = Math.max(
        0,
        parseFloat(total) -
          parseFloat(staked) -
          parseFloat(formatNearAmount(LOCKUP_MIN_BALANCE_FOR_STORAGE))
      ).toFixed(2);

      return {
        available: available,
        staked: lockupStakedBalances?.staked || 0,
        unstaked: lockupStakedBalances?.unstaked || 0,
        withdrawal: lockupStakedBalances?.availableToWithdraw || 0,
      };
    }
    return {
      available: daoNearBalances?.availableParsed || 0,
      staked: daoStakedBalances?.staked || 0,
      unstaked: daoStakedBalances?.unstaked || 0,
      withdrawal: daoStakedBalances?.availableToWithdraw || 0,
    };
  }, [
    selectedWallet,
    lockupContract,
    lockupNearBalances,
    lockupStakedBalances,
    daoNearBalances,
    daoStakedBalances,
  ]);

  // Get appropriate tooltips based on wallet type
  const isLockupWallet = selectedWallet?.value === lockupContract;
  const tooltips = isLockupWallet
    ? TOOLTIP_TEXT.LOCKUP_CONTRACT
    : TOOLTIP_TEXT.DAO_ACCOUNT;

  const BalanceRow = ({ label, balance, tooltipInfo, noBorder }) => (
    <div className="d-flex flex-column">
      <div className={!noBorder ? "border-bottom" : ""}>
        <div className="py-2 d-flex gap-2 align-items-center justify-content-between px-3">
          <div className="h6 mb-0">
            {label}
            {tooltipInfo && (
              <>
                {"  "}
                <Tooltip tooltip={tooltipInfo}>
                  <i className="bi bi-info-circle text-secondary"></i>
                </Tooltip>
              </>
            )}
          </div>
          <div className="h6 mb-0 d-flex align-items-center gap-1">
            {Number(balance).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            NEAR
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="d-flex flex-column gap-1 border border-1 rounded-3 py-2">
      <BalanceRow
        label="Ready to stake"
        balance={balances.available}
        tooltipInfo={tooltips.readyToStake || tooltips.available}
      />
      <BalanceRow
        label="Staked"
        balance={balances.staked}
        tooltipInfo={tooltips.staked}
      />
      <BalanceRow
        label="Pending release"
        balance={balances.unstaked}
        tooltipInfo={tooltips.pendingRelease}
      />
      <BalanceRow
        noBorder={true}
        label="Available for withdrawal"
        balance={balances.withdrawal}
        tooltipInfo={tooltips.availableForWithdraw}
      />
    </div>
  );
};

export default BalanceDisplay;
