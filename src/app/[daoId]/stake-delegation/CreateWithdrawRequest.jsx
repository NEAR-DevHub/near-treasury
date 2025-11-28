"use client";

import { useState, useEffect } from "react";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Modal from "@/components/ui/Modal";
import WalletDropdown from "@/components/dropdowns/WalletDropdown";
import BalanceDisplay from "./BalanceDisplay";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { getValidatorDetails } from "@/api/backend";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import Big from "big.js";
import { REFRESH_DELAY } from "@/constants/ui";

const CreateWithdrawRequest = ({ onCloseCanvas = () => {} }) => {
  const {
    daoId: treasuryDaoID,
    lockupContract,
    daoStakedPools,
    lockupStakedPools,
    daoPolicy,
  } = useDao();
  const { signAndSendTransactions, accountId } = useNearWallet();
  const { showToast } = useProposalToastContext();
  const [withdrawValidators, setWithdrawValidators] = useState([]);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [hasUnstakedAssets, setHasUnstakedAssets] = useState(true);
  const [isReadyToWithdraw, setIsReadyToWithdraw] = useState(true);

  // React Hook Form is not needed here since we auto-select validators
  const [selectedWallet, setSelectedWallet] = useState(null);

  // Set default wallet
  useEffect(() => {
    if (treasuryDaoID && !selectedWallet) {
      setSelectedWallet({
        label: "Sputnik DAO",
        value: treasuryDaoID,
      });
    }
  }, [treasuryDaoID, selectedWallet]);

  // Get fee of staked pools with withdrawal balance
  const getFeeOfStakedPools = async (stakedPoolsWithBalance) => {
    const promises = stakedPoolsWithBalance
      .filter((item) => item.availableToWithdraw > 0.01)
      .map(async (item) => {
        const details = await getValidatorDetails(item.poolId);
        const fee = details?.fees?.numerator
          ? ((details.fees.numerator / details.fees.denominator) * 100).toFixed(
              2
            )
          : "0";
        return {
          pool_id: item.poolId,
          fee,
          stakedBalance: item.staked,
          unstakedBalance: item.unstaked,
          availableToWithdrawBalance: item.availableToWithdraw,
        };
      });

    return Promise.all(promises);
  };

  // Load validators with withdrawal balance
  useEffect(() => {
    const stakedPools =
      selectedWallet?.value === lockupContract
        ? lockupStakedPools
        : daoStakedPools;

    if (stakedPools && stakedPools.length > 0) {
      getFeeOfStakedPools(stakedPools).then((res) => {
        setWithdrawValidators(res);

        // Check if there are unstaked assets and if ready to withdraw
        const hasUnstaked = res.some((v) => v.unstakedBalance > 0.01);
        const hasWithdrawable = res.some(
          (v) => v.availableToWithdrawBalance > 0.01
        );

        setHasUnstakedAssets(hasUnstaked);
        setIsReadyToWithdraw(hasWithdrawable);
      });
    } else {
      setWithdrawValidators([]);
      setHasUnstakedAssets(false);
      setIsReadyToWithdraw(false);
    }
  }, [selectedWallet, lockupContract, daoStakedPools, lockupStakedPools]);

  const onSubmit = async () => {
    if (withdrawValidators.length === 0) return;

    setTxnCreated(true);
    const deposit = daoPolicy?.proposal_bond || 0;
    const isLockupContractSelected = selectedWallet?.value === lockupContract;

    const calls = [];

    // Create a withdraw proposal for each validator with withdrawal balance
    withdrawValidators.forEach((validator) => {
      calls.push({
        receiverId: treasuryDaoID,
        signerId: accountId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "add_proposal",
              args: {
                proposal: {
                  description: encodeToMarkdown({
                    proposal_action: "withdraw",
                    amount: Big(validator.availableToWithdrawBalance)
                      .mul(Big(10).pow(24))
                      .toFixed(),
                  }),
                  kind: {
                    FunctionCall: {
                      receiver_id: isLockupContractSelected
                        ? lockupContract
                        : validator.pool_id,
                      actions: isLockupContractSelected
                        ? [
                            {
                              method_name: "withdraw_all_from_staking_pool",
                              args: "",
                              deposit: "0",
                              gas: "250000000000000",
                            },
                          ]
                        : [
                            {
                              method_name: "withdraw_all",
                              args: "",
                              deposit: "0",
                              gas: "200000000000000",
                            },
                          ],
                    },
                  },
                },
              },
              gas: "200000000000000",
              deposit,
            },
          },
        ],
      });
    });

    try {
      const result = await signAndSendTransactions({
        transactions: calls,
      });

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        // Toast context will automatically fetch proposal ID and invalidate cache
        showToast("WithdrawProposalAdded", null, "stake");
        setTimeout(() => {
          setTxnCreated(false);
          onCloseCanvas();
        }, REFRESH_DELAY);
      }
    } catch (error) {
      console.error("Withdraw request error:", error);
      showToast("ErrorAddingProposal", null, "stake");
      setTxnCreated(false);
    }
  };

  const formatBalance = (amount) => {
    return Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const WarningMessage = ({ message }) => (
    <div className="warning-box d-flex gap-2 align-items-center rounded-2 p-3">
      <i className="bi bi-exclamation-triangle mb-0 h5"></i>
      {message}
    </div>
  );

  const Pools = () => (
    <div className="d-flex flex-column gap-3">
      {Array.isArray(withdrawValidators) && withdrawValidators.length > 0 && (
        <div className="border border-1 rounded-3">
          {withdrawValidators.map((validator, index) => {
            const { pool_id, fee } = validator;

            return (
              <div
                key={index}
                className={`d-flex flex-column gap-2 p-3 ${
                  index < withdrawValidators.length - 1 ? "border-bottom" : ""
                }`}
              >
                <div className="h6 mb-0">{pool_id}</div>
                <div
                  className="d-flex align-items-center gap-2"
                  style={{ fontSize: 13 }}
                >
                  <div className="text-secondary">{fee}% Fee</div>
                </div>
                <div className="d-flex flex-column gap-1">
                  <div
                    className="d-flex align-items-center gap-1"
                    style={{ fontSize: 13 }}
                  >
                    <div className="text-secondary">
                      Available for withdrawal:{" "}
                    </div>
                    <div className="text-warning">
                      {formatBalance(validator.availableToWithdrawBalance)} NEAR
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {withdrawValidators?.length > 1 && (
        <WarningMessage message="By submitting, you request to withdraw all available funds. A separate withdrawal request will be created for each validator." />
      )}
    </div>
  );

  return (
    <>
      <TransactionLoader showInProgress={isTxnCreated} />

      <Modal
        isOpen={showCancelModal}
        heading="Are you sure you want to cancel?"
        onClose={() => setShowCancelModal(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowCancelModal(false)}
            >
              No
            </button>
            <button
              type="button"
              className="btn theme-btn"
              onClick={() => {
                setShowCancelModal(false);
                onCloseCanvas();
              }}
            >
              Yes
            </button>
          </>
        }
      >
        <div className="text-color">
          This action will clear all the information you have entered in the
          form and cannot be undone.
        </div>
      </Modal>

      <div className="d-flex flex-column gap-3">
        {/* Wallet Selection */}
        {lockupContract && (
          <WalletDropdown
            selectedValue={selectedWallet}
            onUpdate={(wallet) => setSelectedWallet(wallet)}
            isStakingDelegationPage={true}
          />
        )}

        {/* Balance Display */}
        <BalanceDisplay selectedWallet={selectedWallet} />

        {/* Validators with Withdrawal Balance */}
        {!isReadyToWithdraw ? (
          <WarningMessage
            message={
              hasUnstakedAssets
                ? "Your balance is not ready for withdrawal yet. It is pending release and will take 1–2 days."
                : "You don't have any unstaked balance available for withdrawal."
            }
          />
        ) : (
          <Pools />
        )}

        {/* Action Buttons */}
        <div className="d-flex gap-3 align-items-center justify-content-end">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowCancelModal(true)}
            disabled={isTxnCreated}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn theme-btn"
            onClick={onSubmit}
            disabled={!withdrawValidators?.length || isTxnCreated}
          >
            Submit
          </button>
        </div>
      </div>
    </>
  );
};

export default CreateWithdrawRequest;
