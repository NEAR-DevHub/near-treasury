"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import Big from "big.js";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Modal from "@/components/ui/Modal";
import WalletDropdown from "@/components/dropdowns/WalletDropdown";
import ValidatorDropdown from "./ValidatorDropdown";
import BalanceDisplay from "./BalanceDisplay";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { getValidators } from "@/api/backend";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import {
  formatNearAmount,
  LOCKUP_MIN_BALANCE_FOR_STORAGE,
} from "@/helpers/nearHelpers";
import { useProposalToastContext } from "@/context/ProposalToastContext";

const CreateUnstakeRequest = ({ onCloseCanvas = () => {} }) => {
  const {
    daoId: treasuryDaoID,
    lockupContract,
    daoNearBalances,
    lockupNearBalances,
    daoStakedBalances,
    lockupStakedBalances,
    daoStakedPools,
    lockupStakedPools,
    lastProposalId,
    daoPolicy,
  } = useDao();
  const { signAndSendTransactions, accountId } = useNearWallet();
  const { showToast } = useProposalToastContext();
  const [validators, setValidators] = useState([]);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      selectedWallet: null,
      selectedValidator: null,
      amount: "",
      notes: "",
    },
  });

  const selectedWallet = watch("selectedWallet");
  const selectedValidator = watch("selectedValidator");
  const amount = watch("amount");
  const notes = watch("notes");

  // Set default wallet
  useEffect(() => {
    if (treasuryDaoID && !selectedWallet) {
      setValue("selectedWallet", {
        label: "Sputnik DAO",
        value: treasuryDaoID,
      });
    }
  }, [treasuryDaoID, selectedWallet, setValue]);

  // Fetch validators - only those with staked balance
  useEffect(() => {
    const stakedPools =
      selectedWallet?.value === lockupContract
        ? lockupStakedPools
        : daoStakedPools;

    if (stakedPools && stakedPools.length > 0) {
      // Filter validators to only show those with staked balance
      getValidators()
        .then((allValidators) => {
          const validatorsWithStake = allValidators.filter((validator) =>
            stakedPools.some(
              (pool) => pool.poolId === validator.pool_id && pool.staked > 0
            )
          );
          setValidators(validatorsWithStake);
        })
        .catch((err) => console.error("Error fetching validators:", err));
    } else {
      setValidators([]);
    }
  }, [selectedWallet, lockupContract, daoStakedPools, lockupStakedPools]);

  // Get balances based on selected wallet
  const getBalances = () => {
    if (selectedWallet?.value === lockupContract) {
      const locked = lockupNearBalances?.contractLockedParsed || 0;
      const total = lockupNearBalances?.totalParsed || 0;
      const available = Math.max(
        0,
        parseFloat(total) -
          parseFloat(locked) -
          parseFloat(LOCKUP_MIN_BALANCE_FOR_STORAGE)
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
  };

  const balances = getBalances();

  // Get max unstake amount for selected validator
  const getMaxUnstakeAmount = () => {
    if (!selectedValidator) return 0;
    const stakedPools =
      selectedWallet?.value === lockupContract
        ? lockupStakedPools
        : daoStakedPools;
    const pool = stakedPools?.find(
      (p) => p.poolId === selectedValidator.pool_id
    );
    return pool?.staked || 0;
  };

  const maxUnstakeAmount = getMaxUnstakeAmount();

  // Validation
  const isAmountValid = () => {
    if (!amount) return false;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return false;
    if (amountNum > maxUnstakeAmount) return false;
    return true;
  };

  const onSubmit = async (data) => {
    if (!selectedValidator || !isAmountValid()) {
      return;
    }

    setTxnCreated(true);
    const deposit = daoPolicy?.proposal_bond || 0;
    const isLockupContractSelected = selectedWallet?.value === lockupContract;
    const validatorAccount = selectedValidator.pool_id;
    const amountInYocto = Big(amount).mul(Big(10).pow(24)).toFixed();

    const calls = [];

    // Step 1: Unstake request
    const unstakeDescription = {
      proposal_action: "unstake",
      notes: notes,
    };

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
                description: encodeToMarkdown(unstakeDescription),
                kind: {
                  FunctionCall: {
                    receiver_id: isLockupContractSelected
                      ? lockupContract
                      : validatorAccount,
                    actions: isLockupContractSelected
                      ? [
                          {
                            method_name: "unstake",
                            args: btoa(
                              JSON.stringify({
                                amount: amountInYocto,
                              })
                            ),
                            deposit: "0",
                            gas: "125000000000000",
                          },
                        ]
                      : [
                          {
                            method_name: "unstake",
                            args: btoa(
                              JSON.stringify({
                                amount: amountInYocto,
                              })
                            ),
                            deposit: "0",
                            gas: "125000000000000",
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

    // Step 2: Auto-create withdraw request (to be approved after unstaking completes)
    const withdrawDescription = {
      proposal_action: "withdraw",
      showAfterProposalIdApproved: lastProposalId,
      customNotes: `Following [#${lastProposalId}](?id=${lastProposalId}) unstake request`,
      amount: amountInYocto,
    };

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
                description: encodeToMarkdown(withdrawDescription),
                kind: {
                  FunctionCall: {
                    receiver_id: isLockupContractSelected
                      ? lockupContract
                      : validatorAccount,
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

    console.log("Unstake request calls:", calls);

    try {
      const result = await signAndSendTransactions({
        transactions: calls,
      });

      console.log("Unstake request result:", result);

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        // Toast context will automatically fetch proposal ID and invalidate cache
        showToast("UnstakeProposalAdded", null, "stake");
        setTxnCreated(false);
        reset();
        onCloseCanvas();
      }
    } catch (error) {
      console.error("Unstake request error:", error);
      showToast("ErrorAddingProposal", null, "stake");
      setTxnCreated(false);
    }
  };

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
                reset();
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

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="d-flex flex-column gap-3"
      >
        {/* Wallet Selection */}
        {lockupContract && (
          <WalletDropdown
            selectedValue={selectedWallet}
            onUpdate={(wallet) => {
              setValue("selectedWallet", wallet, { shouldValidate: true });
              // Reset form fields on wallet change
              setValue("selectedValidator", null);
              setValue("amount", "");
              setValue("notes", "");
            }}
            isStakingDelegationPage={true}
          />
        )}

        {/* Balance Display */}
        <BalanceDisplay selectedWallet={selectedWallet} />

        {/* Warning if no staked tokens */}
        {parseFloat(balances.staked) === 0 && (
          <div
            className="d-flex gap-2 align-items-center p-3 rounded-2"
            style={{
              backgroundColor: "var(--grey-04)",
              color: "var(--grey-02)",
              fontSize: 13,
            }}
          >
            <i className="bi bi-info-circle h6 mb-0"></i>
            <span>
              You don't have any staked tokens with a validator. Please stake
              tokens first.
            </span>
          </div>
        )}

        {/* Validator Selection */}
        <div className="d-flex flex-column">
          <label className="form-label fw-medium mb-1">
            Validator
            {errors.selectedValidator && (
              <span className="text-danger ms-1">*</span>
            )}
          </label>
          <ValidatorDropdown
            options={validators}
            selectedValidator={selectedValidator}
            onSelect={(validator) =>
              setValue("selectedValidator", validator, { shouldValidate: true })
            }
            disabled={isTxnCreated || validators.length === 0}
            showStakingInfo={true}
            selectedWallet={selectedWallet?.value}
          />
          <input
            type="hidden"
            {...register("selectedValidator", {
              required: "Please select a validator",
            })}
          />
          {errors.selectedValidator && (
            <div className="text-danger mt-1" style={{ fontSize: "0.875rem" }}>
              {errors.selectedValidator.message}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="d-flex flex-column">
          <div className="d-flex justify-content-between mb-1">
            <label className="form-label fw-medium">
              Amount
              {errors.amount && <span className="text-danger ms-1">*</span>}
            </label>
            {selectedValidator && maxUnstakeAmount > 0 && (
              <div
                className="px-3 py-1 rounded-2"
                style={{ color: "#007aff", cursor: "pointer", fontSize: 13 }}
                onClick={() =>
                  setValue("amount", maxUnstakeAmount.toString(), {
                    shouldValidate: true,
                  })
                }
              >
                Use Max
              </div>
            )}
          </div>
          <input
            type="number"
            step="any"
            className="form-control"
            placeholder="Enter amount in NEAR"
            disabled={isTxnCreated || !selectedValidator}
            {...register("amount", {
              required: "Amount is required",
              validate: {
                positive: (v) => parseFloat(v) > 0 || "Amount must be positive",
                sufficient: (v) =>
                  parseFloat(v) <= maxUnstakeAmount ||
                  `Amount exceeds staked balance (${maxUnstakeAmount} NEAR)`,
              },
            })}
          />
          {selectedValidator && (
            <div
              className="d-flex align-items-center gap-1 text-secondary mt-1"
              style={{ fontSize: 13 }}
            >
              Available to unstake: {maxUnstakeAmount} NEAR
            </div>
          )}
          {errors.amount && (
            <div className="text-danger mt-1" style={{ fontSize: "0.875rem" }}>
              {errors.amount.message}
            </div>
          )}
        </div>

        {/* Warning about unstaking */}
        {selectedValidator && amount && parseFloat(amount) > 0 && (
          <div
            className="d-flex gap-2 align-items-center p-3 rounded-2"
            style={{
              backgroundColor: "var(--grey-04)",
              color: "var(--grey-02)",
              fontSize: 13,
            }}
          >
            <i className="bi bi-info-circle h6 mb-0"></i>
            <span>
              By submitting, you create two requests: an unstake request and a
              follow-up withdrawal request. The withdrawal request will appear
              after the unstake is approved and the 52-65 hour waiting period
              completes.
            </span>
          </div>
        )}

        {/* Notes */}
        <div className="d-flex flex-column">
          <label className="form-label fw-medium mb-1">Notes</label>
          <textarea
            className="form-control"
            rows="3"
            placeholder="Enter your notes here..."
            disabled={isTxnCreated}
            {...register("notes")}
          />
        </div>

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
            type="submit"
            className="btn theme-btn"
            disabled={isTxnCreated || validators.length === 0}
          >
            Submit
          </button>
        </div>
      </form>
    </>
  );
};

export default CreateUnstakeRequest;
