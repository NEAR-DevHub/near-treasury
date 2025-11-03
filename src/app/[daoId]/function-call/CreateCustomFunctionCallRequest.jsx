"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Big from "big.js";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Modal from "@/components/ui/Modal";
import { useDao } from "@/context/DaoContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { Near } from "@/api/near";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import { isValidNearAccount } from "@/helpers/nearHelpers";
import { useNearWallet } from "@/context/NearWalletContext";

const CreateCustomFunctionCallRequest = ({ onCloseCanvas = () => {} }) => {
  const { daoId: treasuryDaoID, daoPolicy } = useDao();
  const { signAndSendTransactions, accountId } = useNearWallet();
  const { showToast } = useProposalToastContext();

  const [isTxnCreated, setTxnCreated] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [contractValidationError, setContractValidationError] = useState(null);
  const [isValidatingContract, setIsValidatingContract] = useState(false);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      contractId: "",
      notes: "",
      actions: [
        {
          methodName: "",
          argumentsJson: "",
          gas: "",
          deposit: "",
        },
      ],
    },
  });

  const watchedActions = watch("actions");
  const watchedContractId = watch("contractId");

  // Add a new action
  const addAction = () => {
    const currentActions = watchedActions || [];
    setValue("actions", [
      ...currentActions,
      {
        methodName: "",
        argumentsJson: "",
        gas: "",
        deposit: "",
      },
    ]);
  };

  // Remove an action
  const removeAction = (index) => {
    const currentActions = watchedActions || [];
    if (currentActions.length === 1) return; // Keep at least one action
    setValue(
      "actions",
      currentActions.filter((_, i) => i !== index)
    );
  };

  // Form submission handler
  const onSubmit = async (data) => {
    // Clear any previous contract validation error
    setContractValidationError(null);

    // Check if there are any validation errors - return early if validation fails
    if (!isValid || Object.keys(errors).length > 0) {
      return;
    }

    // Additional API validation for contract ID
    if (data.contractId && data.contractId.trim()) {
      setIsValidatingContract(true);
      try {
        const accountData = await Near.viewAccount(data.contractId);
        if (!accountData) {
          setContractValidationError(
            "Contract does not exist on NEAR blockchain"
          );
          setIsValidatingContract(false);
          return;
        }
      } catch (error) {
        setContractValidationError(
          "Error validating contract. Please try again."
        );
        setIsValidatingContract(false);
        return;
      }
      setIsValidatingContract(false);
    }

    // If we reach here, all validations passed
    setTxnCreated(true);

    try {
      // Build actions array with proper conversions
      const builtActions = data.actions.map((action) => {
        // Parse arguments if provided
        let parsedArguments = "";
        if (action.argumentsJson.trim()) {
          const jsonArgs = JSON.parse(action.argumentsJson);
          parsedArguments = Buffer.from(JSON.stringify(jsonArgs)).toString(
            "base64"
          );
        }

        // Convert gas from Tgas to gas units (1 Tgas = 10^12 gas)
        const gasInUnits = Big(action.gas).mul(Big(10).pow(12)).toFixed();

        // Convert deposit from NEAR to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const depositInYoctoNEAR = Big(action.deposit)
          .mul(Big(10).pow(24))
          .toFixed();

        return {
          method_name: action.methodName,
          args: parsedArguments,
          gas: gasInUnits,
          deposit: depositInYoctoNEAR,
        };
      });

      // Create the proposal data
      const proposalData = {
        description: encodeToMarkdown({
          notes: data.notes,
        }),
        kind: {
          FunctionCall: {
            receiver_id: data.contractId,
            actions: builtActions,
          },
        },
      };

      // Get proposal bond from DAO policy
      const proposalBond = daoPolicy?.proposal_bond || 0;

      // Submit the proposal using Near.call
      const calls = [
        {
          receiverId: treasuryDaoID,
          signerId: accountId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "add_proposal",
                args: {
                  proposal: proposalData,
                },
              },
              gas: "300000000000000", // 300 Tgas
              deposit: proposalBond, // Use proposal bond from DAO policy
            },
          ],
        },
      ];

      console.log("calls", calls);
      const result = await await signAndSendTransactions({
        transactions: calls,
      });

      if (
        result &&
        result.length > 0 &&
        typeof result[0]?.status?.SuccessValue === "string"
      ) {
        showToast("ProposalAdded", null, "function");
        setTxnCreated(false);
        reset();
        onCloseCanvas();
      }
    } catch (error) {
      showToast("ErrorAddingProposal", null, "function");
      console.error("Error creating proposal:", error);
    } finally {
      setTxnCreated(false);
    }
  };

  const handleCancel = () => {
    const hasData =
      watchedContractId ||
      (watchedActions || []).some(
        (action) =>
          action.methodName ||
          action.argumentsJson ||
          action.gas ||
          action.deposit
      ) ||
      watch("notes");

    if (hasData) {
      setShowCancelModal(true);
    } else {
      onCloseCanvas();
    }
  };

  return (
    <div>
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

      <div className="warning-box d-flex align-items-start gap-2 px-3 py-2 rounded-2 mb-3">
        <i className="bi bi-exclamation-triangle h5 mb-0 text-warning"></i>
        <div>
          <strong>Heads Up: Advanced Feature</strong>
          <div className="mt-2">
            You are about to create a custom transaction request that will
            interact directly with a smart contract. This is a powerful action,
            and mistakes can be irreversible.
          </div>
          <div className="mt-2">
            <strong>Please triple-check the following details:</strong>
            <ul className="mb-1">
              <li>Contract ID is correct and trusted.</li>
              <li>Method Name & Arguments are accurate.</li>
              <li>Gas & Deposit amounts are appropriate.</li>
            </ul>
          </div>
          <div className="mt-2">
            <a
              href="https://docs.neartreasury.com/advanced/function_calls"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-underline fw-bold"
            >
              Learn more
            </a>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-3">
          <label htmlFor="contractId" className="form-label">
            Contract ID <span className="text-danger">*</span>
          </label>
          <div className="position-relative">
            <input
              type="text"
              className={`form-control ${
                errors.contractId || contractValidationError ? "is-invalid" : ""
              }`}
              id="contractId"
              placeholder="e.g., example.near or 1234567890abcdef..."
              disabled={isValidatingContract}
              {...register("contractId", {
                required: "Contract ID is required",
                validate: (value) => {
                  if (!value || !value.trim()) {
                    return "Contract ID is required";
                  }
                  if (!isValidNearAccount(value)) {
                    return "Invalid NEAR account format";
                  }
                  return true;
                },
              })}
            />
            {isValidatingContract && (
              <div className="position-absolute top-50 end-0 translate-middle-y pe-3">
                <div
                  className="spinner-border spinner-border-sm text-primary"
                  role="status"
                >
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}
          </div>
          {(errors.contractId || contractValidationError) && (
            <div className="invalid-feedback d-block">
              {errors.contractId?.message || contractValidationError}
            </div>
          )}
        </div>

        {/* Actions */}
        {(watchedActions || []).map((action, index) => (
          <div key={index} className="border rounded-3 overflow-hidden mb-3">
            <div
              className="d-flex justify-content-between align-items-center px-3 py-2"
              style={{
                backgroundColor: "var(--bg-system-color)",
              }}
            >
              <h6 className="mb-0">Action {index + 1}</h6>
              {(watchedActions || []).length > 1 && (
                <div
                  type="button"
                  className="cursor-pointer text-red px-2 py-1"
                  onClick={() => removeAction(index)}
                  data-testid={`remove-action-${index}`}
                >
                  <i className="bi bi-trash"></i>
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-top rounded-top-3">
              {/* Method Name */}
              <div className="mb-3">
                <label className="form-label">
                  Method Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${
                    errors.actions?.[index]?.methodName ||
                    errors[`actions.${index}.methodName`]
                      ? "is-invalid"
                      : ""
                  }`}
                  placeholder="e.g., ft_transfer"
                  {...register(`actions.${index}.methodName`, {
                    required: "Method Name is required",
                    validate: (value) => {
                      if (!value || value.trim() === "")
                        return "Method Name is required";
                      const methodRegex = /^[a-zA-Z0-9_]+$/;
                      if (!methodRegex.test(value)) {
                        return "Method name must be a single word (letters, numbers, underscore only)";
                      }
                      return true;
                    },
                  })}
                />
                {(errors.actions?.[index]?.methodName ||
                  errors[`actions.${index}.methodName`]) && (
                  <div className="invalid-feedback d-block">
                    {
                      (
                        errors.actions?.[index]?.methodName ||
                        errors[`actions.${index}.methodName`]
                      ).message
                    }
                  </div>
                )}
              </div>

              {/* Arguments (JSON) */}
              <div className="mb-3">
                <label className="form-label">Arguments (Optional)</label>
                <textarea
                  className={`form-control ${
                    errors.actions?.[index]?.argumentsJson ||
                    errors[`actions.${index}.argumentsJson`]
                      ? "is-invalid"
                      : ""
                  }`}
                  rows="4"
                  placeholder={`{
  "receiver_id": "alice.near",
  "amount": "10000000000000"
}`}
                  {...register(`actions.${index}.argumentsJson`, {
                    validate: (value) => {
                      if (!value || value.trim() === "") return true; // Arguments are optional
                      try {
                        const parsed = JSON.parse(value);
                        if (parsed === null && value.trim() !== "null") {
                          return "Invalid JSON format";
                        }
                        if (typeof parsed === "string") {
                          return "Arguments must be a JSON object or array, not a string";
                        }
                        return true;
                      } catch (error) {
                        return "Invalid JSON format";
                      }
                    },
                  })}
                />
                {(errors.actions?.[index]?.argumentsJson ||
                  errors[`actions.${index}.argumentsJson`]) && (
                  <div className="invalid-feedback d-block">
                    {
                      (
                        errors.actions?.[index]?.argumentsJson ||
                        errors[`actions.${index}.argumentsJson`]
                      ).message
                    }
                  </div>
                )}
              </div>

              {/* Gas and Deposit */}
              <div>
                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label">
                      Gas (Tgas) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      className={`form-control ${
                        errors.actions?.[index]?.gas ||
                        errors[`actions.${index}.gas`]
                          ? "is-invalid"
                          : ""
                      }`}
                      placeholder="30"
                      {...register(`actions.${index}.gas`, {
                        required: "Gas (Tgas) is required",
                        validate: (value) => {
                          if (!value || value.trim() === "")
                            return "Gas (Tgas) is required";
                          const gasNumber = parseFloat(value);
                          if (isNaN(gasNumber) || gasNumber <= 0)
                            return "Gas must be a positive number";
                          if (gasNumber > 300)
                            return "Gas must be between 0 and 300 Tgas";
                          return true;
                        },
                      })}
                    />
                    {(errors.actions?.[index]?.gas ||
                      errors[`actions.${index}.gas`]) && (
                      <div className="invalid-feedback d-block">
                        {
                          (
                            errors.actions?.[index]?.gas ||
                            errors[`actions.${index}.gas`]
                          ).message
                        }
                      </div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      Deposit (NEAR) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.000000000000000000000001"
                      className={`form-control ${
                        errors.actions?.[index]?.deposit ||
                        errors[`actions.${index}.deposit`]
                          ? "is-invalid"
                          : ""
                      }`}
                      placeholder="0"
                      {...register(`actions.${index}.deposit`, {
                        required: "Deposit (NEAR) is required",
                        validate: (value) => {
                          if (!value || value.trim() === "")
                            return "Deposit (NEAR) is required";
                          const depositNumber = parseFloat(value);
                          if (isNaN(depositNumber) || depositNumber < 0)
                            return "Deposit must be a non-negative number";
                          return true;
                        },
                      })}
                    />
                    {(errors.actions?.[index]?.deposit ||
                      errors[`actions.${index}.deposit`]) && (
                      <div className="invalid-feedback d-block">
                        {
                          (
                            errors.actions?.[index]?.deposit ||
                            errors[`actions.${index}.deposit`]
                          ).message
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn btn-outline-secondary mb-3"
          onClick={addAction}
        >
          Add Another Action
        </button>

        <div className="mb-3">
          <label htmlFor="notes" className="form-label">
            Notes (Optional)
          </label>
          <textarea
            className={`form-control ${errors.notes ? "is-invalid" : ""}`}
            id="notes"
            rows="3"
            {...register("notes")}
            placeholder="Describe what this function call will do..."
          />
          {errors.notes && (
            <div className="invalid-feedback d-block">
              {errors.notes.message}
            </div>
          )}
        </div>

        <div className="d-flex gap-2 justify-content-end">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isTxnCreated}
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn primary-button"
            disabled={isTxnCreated}
          >
            Create Request
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCustomFunctionCallRequest;
