"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import Big from "big.js";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Modal from "@/components/ui/Modal";
import WalletDropdown from "@/components/dropdowns/WalletDropdown";
import Tooltip from "@/components/ui/Tooltip";
import ValidatorDropdown from "./ValidatorDropdown";
import BalanceDisplay from "./BalanceDisplay";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { Near } from "@/api/near";
import { getValidators } from "@/api/backend";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import {
  formatNearAmount,
  LOCKUP_MIN_BALANCE_FOR_STORAGE,
} from "@/helpers/nearHelpers";

const CreateStakeRequest = ({
  onCloseCanvas = () => {},
  setVoteProposalId,
  setToastStatus,
}) => {
  const {
    daoId: treasuryDaoID,
    lockupContract,
    daoNearBalances,
    lockupNearBalances,
    daoStakedBalances,
    lockupStakedBalances,
    lastProposalId,
    daoPolicy,
    lockupStakedPoolId,
    refetchLastProposalId,
  } = useDao();
  const { signAndSendTransactions, accountId } = useNearWallet();

  const [validators, setValidators] = useState([]);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [lockupAlreadyStaked, setLockupAlreadyStaked] = useState(false);

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

  // Check if lockup already has a validator staked
  useEffect(() => {
    if (selectedWallet?.value === lockupContract && lockupStakedPoolId) {
      setLockupAlreadyStaked(true);
      // Auto-select the staked pool
      setValue("selectedValidator", { pool_id: lockupStakedPoolId });
    } else {
      setLockupAlreadyStaked(false);
    }
  }, [selectedWallet, lockupContract, lockupStakedPoolId, setValue]);

  // Fetch validators
  useEffect(() => {
    getValidators()
      .then((data) => setValidators(data || []))
      .catch((err) => console.error("Error fetching validators:", err));
  }, []);

  // Get available balance for validation only
  const getAvailableBalance = () => {
    if (selectedWallet?.value === lockupContract) {
      const locked = lockupNearBalances?.contractLockedParsed || 0;
      const total = lockupNearBalances?.totalParsed || 0;
      return Math.max(
        0,
        parseFloat(total) -
          parseFloat(locked) -
          parseFloat(LOCKUP_MIN_BALANCE_FOR_STORAGE)
      ).toFixed(2);
    }
    return daoNearBalances?.availableParsed || 0;
  };

  const availableBalance = getAvailableBalance();

  // Validation
  const isAmountValid = () => {
    if (!amount) return false;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return false;
    if (amountNum > parseFloat(availableBalance)) return false;
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

    // Check if we need to add select_staking_pool call first (for lockup only)
    const addSelectPoolCall =
      isLockupContractSelected && validatorAccount !== lockupStakedPoolId;

    const calls = [];

    // Step 1: Whitelist validator (if needed for lockup)
    if (addSelectPoolCall) {
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
                    proposal_action: "stake",
                    customNotes:
                      "Approve to designate this validator with this lockup account. Lockup accounts can only have one validator.",
                  }),
                  kind: {
                    FunctionCall: {
                      receiver_id: lockupContract,
                      actions: [
                        {
                          method_name: "select_staking_pool",
                          args: btoa(
                            JSON.stringify({
                              staking_pool_account_id: validatorAccount,
                            })
                          ),
                          deposit: "0",
                          gas: "100000000000000",
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
    }

    // Step 2: Stake request
    const description = {
      proposal_action: "stake",
      notes: notes,
    };

    // If we added select_pool call, this should wait for it
    if (addSelectPoolCall) {
      description["showAfterProposalIdApproved"] = lastProposalId;
    }

    const amountInYocto = Big(amount).mul(Big(10).pow(24)).toFixed();

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
                description: encodeToMarkdown(description),
                kind: {
                  FunctionCall: {
                    receiver_id: isLockupContractSelected
                      ? lockupContract
                      : validatorAccount,
                    actions: isLockupContractSelected
                      ? [
                          {
                            method_name: "deposit_and_stake",
                            args: btoa(
                              JSON.stringify({
                                amount: amountInYocto,
                              })
                            ),
                            deposit: "0",
                            gas: "150000000000000",
                          },
                        ]
                      : [
                          {
                            method_name: "deposit_and_stake",
                            args: "",
                            deposit: amountInYocto,
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

    console.log("Stake request calls:", calls);

    try {
      const result = await signAndSendTransactions({
        transactions: calls,
      });

      console.log("Stake request result:", result);

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        refetchLastProposalId().then((id) => {
          setVoteProposalId(id);
          setToastStatus("StakeProposalAdded");
          setTxnCreated(false);
          reset();
          onCloseCanvas();
        });
      }
    } catch (error) {
      console.error("Stake request error:", error);
      setToastStatus("ErrorAddingProposal");
      setTxnCreated(false);
    }
  };

  return (
    <>
      <TransactionLoader
        showInProgress={isTxnCreated}
        cancelTxn={() => setTxnCreated(false)}
      />

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
            disabled={lockupAlreadyStaked || isTxnCreated}
            showStakingInfo={false}
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

        {lockupAlreadyStaked && (
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
              You cannot split your locked funds across multiple validators. To
              change your validator, please contact our support team.
            </span>
          </div>
        )}

        {/* Amount Input */}
        <div className="d-flex flex-column">
          <div className="d-flex justify-content-between mb-1">
            <label className="form-label fw-medium mb-1">
              Amount
              {errors.amount && <span className="text-danger ms-1">*</span>}
            </label>
            <div
              className="px-3 py-1 rounded-2"
              style={{ color: "#007aff", cursor: "pointer", fontSize: 13 }}
              onClick={() =>
                setValue("amount", availableBalance, { shouldValidate: true })
              }
            >
              Use Max
            </div>
          </div>
          <input
            type="number"
            step="any"
            className="form-control"
            placeholder="Enter amount in NEAR"
            disabled={isTxnCreated}
            {...register("amount", {
              required: "Amount is required",
              validate: {
                positive: (v) => parseFloat(v) > 0 || "Amount must be positive",
                sufficient: (v) =>
                  parseFloat(v) <= parseFloat(availableBalance) ||
                  "Insufficient balance",
              },
            })}
          />
          <div
            className="d-flex align-items-center gap-1 text-secondary mt-1"
            style={{ fontSize: 13 }}
          >
            Available: {availableBalance} NEAR
          </div>
          {errors.amount && (
            <div className="text-danger mt-1" style={{ fontSize: "0.875rem" }}>
              {errors.amount.message}
            </div>
          )}
        </div>

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
            disabled={isTxnCreated}
          >
            Submit
          </button>
        </div>
      </form>
    </>
  );
};

export default CreateStakeRequest;
