"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { getProposalsFromIndexer } from "@/api/indexer";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import Modal from "@/components/ui/Modal";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import Skeleton from "@/components/ui/Skeleton";
import Profile from "@/components/ui/Profile";
import DropDown from "@/components/dropdowns/DropDown";
import { logger } from "@/helpers/logger";
import Tooltip from "@/components/ui/Tooltip";

const options = [
  {
    label: "Number of votes",
    value: "number",
    description: "A fixed number of votes is required for a decision to pass.",
  },
  {
    label: "Percentage of members",
    value: "percentage",
    description:
      "A percentage of the total group members must vote for a decision to pass.",
  },
];

const proposalKinds = [
  "config",
  "policy",
  "add_bounty",
  "bounty_done",
  "transfer",
  "vote",
  "remove_member_from_role",
  "add_member_to_role",
  "call",
  "upgrade_self",
  "upgrade_remote",
  "set_vote_token",
];

function getRoleWiseData(daoPolicy) {
  if (!daoPolicy?.roles) return [];

  const data = [];
  const defaultPolicy = daoPolicy.default_vote_policy;

  daoPolicy.roles.forEach((role) => {
    // Sort members alphabetically
    const members = (role.kind?.Group ?? []).sort((a, b) => a.localeCompare(b));

    // if there is no role.vote_policy, default is applied
    const threshold = Object.keys(role?.vote_policy ?? {}).length
      ? Object.values(role?.vote_policy)?.[0]?.threshold
      : defaultPolicy.threshold;
    const isRatio = Array.isArray(threshold);

    data.push({
      roleName: role.name,
      members,
      isRatio,
      threshold: isRatio
        ? threshold[1] === 100
          ? threshold[0]
          : (threshold[0] / threshold[1]) * 100
        : threshold,
      requiredVotes: isRatio
        ? Math.floor((threshold[0] / threshold[1]) * role.kind?.Group.length) +
          1
        : threshold ?? 1,
      option: isRatio ? "percentage" : "number",
    });
  });

  return data;
}

function getRolesThresholdDescription(type) {
  switch (type) {
    case "Approver":
      return "Vote for Payments, Stake Delegation, and Asset Exchange.";
    case "Admin":
      return "Vote for Members and Settings.";
    default:
      return "";
  }
}

function computeRequiredVotes(
  selectedGroup,
  selectedVoteOption,
  options,
  selectedVoteValue
) {
  if (!selectedGroup) return 0;

  const isPercentageSelected = selectedVoteOption?.value === options[1].value;

  if (isPercentageSelected) {
    const inputPercentage = parseInt(selectedVoteValue) || 0;
    const totalMembers = selectedGroup.members?.length || 0;
    const calculatedVotes =
      Math.floor((inputPercentage / 100) * totalMembers) + 1;
    return Math.min(calculatedVotes, totalMembers);
  } else {
    return parseInt(selectedVoteValue);
  }
}

const Thresholds = () => {
  const { daoId: treasuryDaoID, hasPermission, daoPolicy } = useDao();
  const { accountId, signAndSendTransactions } = useNearWallet();

  const {
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { isDirty, errors },
  } = useForm({
    defaultValues: {
      voteOption: "number",
      voteValue: "",
    },
  });

  const voteOption = watch("voteOption");
  const voteValue = watch("voteValue");

  const { showToast } = useProposalToastContext();

  const [rolesData, setRolesData] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const hasCreatePermission = hasPermission?.("policy", "AddProposal");

  // Initialize roles data
  useEffect(() => {
    if (daoPolicy) {
      const roles = getRoleWiseData(daoPolicy);
      const filteredRoles = roles.filter(
        (i) =>
          i.roleName !== "Create Requests" &&
          i.roleName !== "Requestor" &&
          i.roleName !== "Create requests" &&
          i.roleName !== "all"
      );
      setRolesData(filteredRoles);
      if (filteredRoles.length > 0) {
        const firstRole = filteredRoles[0];
        setSelectedGroup(firstRole);
        const initialOption = firstRole.isRatio ? options[1] : options[0];
        reset({
          voteOption: initialOption.value,
          voteValue: firstRole.threshold.toString(),
        });
      }
      setLoading(false);
    }
  }, [daoPolicy]);

  function checkProposals() {
    getProposalsFromIndexer({
      daoId: treasuryDaoID,
      page: 0,
      pageSize: 10,
      proposalType: ["ChangePolicy"],
      statuses: ["InProgress"],
      sortDirection: "desc",
    })
      .then((result) => {
        setProposals(result.proposals || []);
      })
      .catch((error) => {
        logger.error("Error fetching proposals:", error);
      });
  }

  // Fetch pending proposals
  useEffect(() => {
    if (hasCreatePermission && treasuryDaoID) {
      checkProposals();
    }
  }, [hasCreatePermission, treasuryDaoID]);

  // Get current form values
  const selectedVoteOption =
    options.find((opt) => opt.value === voteOption) || options[0];
  const selectedVoteValue = voteValue;

  const isPercentageSelected = selectedVoteOption.value === options[1].value;

  const requiredVotes = selectedGroup
    ? computeRequiredVotes(
        selectedGroup,
        selectedVoteOption,
        options,
        selectedVoteValue
      )
    : 0;

  const disableSubmit =
    !isDirty ||
    !selectedVoteValue ||
    errors.voteValue ||
    !hasCreatePermission ||
    isTxnCreated;

  const resetForm = () => {
    const initialOption = selectedGroup.isRatio ? options[1] : options[0];
    clearErrors("voteValue");
    reset({
      voteOption: initialOption.value,
      voteValue: selectedGroup.threshold.toString(),
    });
  };

  const updateDaoPolicy = () => {
    if (!daoPolicy) return null;

    const updatedPolicy = {
      ...daoPolicy,
      roles: daoPolicy.roles?.map((role) => {
        if (role.name === selectedGroup.roleName) {
          const vote_policy = proposalKinds.reduce((policy, kind) => {
            policy[kind] = {
              weight_kind: "RoleWeight",
              quorum: "0",
              threshold: isPercentageSelected
                ? [parseInt(selectedVoteValue), 100]
                : selectedVoteValue,
            };
            return policy;
          }, {});
          return {
            ...role,
            vote_policy,
          };
        }
        return role;
      }),
    };
    return updatedPolicy;
  };

  const onSubmitClick = async () => {
    if (!daoPolicy) return;

    setTxnCreated(true);
    const deposit = daoPolicy?.proposal_bond || 0;
    const updatedPolicy = updateDaoPolicy();

    const description = {
      title: "Update policy - Voting Thresholds",
      summary: `${accountId} requested to change voting threshold from ${selectedGroup.requiredVotes} to ${requiredVotes}.`,
    };

    try {
      const result = await signAndSendTransactions([
        {
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
                      ChangePolicy: {
                        policy: updatedPolicy,
                      },
                    },
                  },
                },
                gas: 200000000000000,
                deposit,
              },
            },
          ],
        },
      ]);

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        checkProposals();
        setTxnCreated(false);
        showToast("ProposalAdded", null, "settings");
        resetForm();
      }
    } catch (error) {
      logger.error("Error submitting proposal:", error);
      setTxnCreated(false);
      showToast("ErrorAddingProposal", null, "settings");
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  if (loading || !daoPolicy) {
    return (
      <div className="card rounded-4 d-flex flex-column gap-3 p-3">
        <div className="card-title">Voting Thresholds</div>
        <Skeleton className="w-100 rounded-3" style={{ height: "200px" }} />
      </div>
    );
  }

  if (!rolesData.length || !selectedGroup) {
    return (
      <div className="card rounded-4 d-flex justify-content-center align-items-center">
        <div className="text-center">No permission groups found</div>
      </div>
    );
  }

  const Table = ({ currentGroup, newGroup }) => {
    const data = [
      {
        label: "Permission Group Size",
        current: `${currentGroup.members.length} members`,
        new: `${newGroup.members.length} members`,
      },
      {
        label: "Based On",
        current:
          currentGroup.option === "number"
            ? "Number of Votes"
            : "Percentage of Members",
        new:
          newGroup.option === "number"
            ? "Number of Votes"
            : "Percentage of Members",
      },
      {
        label: "Selected Value",
        current: `${
          currentGroup.option === "percentage"
            ? currentGroup.threshold[0]
            : currentGroup.threshold
        } ${currentGroup.option === "percentage" ? "%" : ""}`,
        new: `${
          newGroup.option === "percentage"
            ? newGroup.threshold[0]
            : newGroup.threshold
        } ${newGroup.option === "percentage" ? "%" : ""}`,
      },
      {
        label: "Required Vote(s) for Approval",
        current: currentGroup.requiredVotes,
        new: newGroup.requiredVotes,
      },
    ];

    return (
      <table className="table table-compact my-0">
        <thead>
          <tr>
            <th className="fw-bold"></th>
            <th className="fw-bold text-center">Current Setup</th>
            <th className="fw-bold text-center">New Setup</th>
          </tr>
        </thead>
        <tbody>
          {data.map((config, index) => (
            <tr key={index}>
              <td className="text-left fw-semi-bold">{config.label}</td>
              <td className="text-center">{config.current}</td>
              <td className="text-center">{config.new}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="text-color">
      <TransactionLoader
        showInProgress={isTxnCreated}
        cancelTxn={() => setTxnCreated(false)}
      />

      {showWarningModal && (
        <Modal
          heading="Resolve Before Proceeding"
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          minWidth="700px"
        >
          <div className="p-3">
            <p className="mb-3">
              This action will override your previous pending proposals.
              Complete existing one before creating a new to avoid conflicting
              or incomplete updates.
            </p>
            <div className="d-flex flex-column gap-2">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="p-3 border rounded">
                  <div className="fw-bold">Proposal #{proposal.id}</div>
                  <div className="text-sm text-secondary">
                    {proposal.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {showConfirmModal && (
        <Modal
          heading="Confirm Your Change"
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          wider={true}
          size="lg"
        >
          <div>
            {requiredVotes > 1 && (
              <div
                className="warning-box d-flex align-items-center gap-1 rounded-3 p-2"
                style={{ fontSize: "16px" }}
              >
                <i className="bi bi-exclamation-triangle me-2"></i>
                Changing this setting will require {requiredVotes} votes to
                approve requests.
                {selectedGroup.requiredVotes === 1 &&
                  ` You will no longer be able to approve requests with a single vote.`}
              </div>
            )}
            <Table
              currentGroup={
                selectedGroup.isRatio
                  ? {
                      ...selectedGroup,
                      threshold: [selectedGroup.threshold, 100],
                      option: "percentage",
                    }
                  : {
                      ...selectedGroup,
                      option: "number",
                    }
              }
              newGroup={
                selectedVoteOption.value === options[1].value
                  ? {
                      members: selectedGroup.members,
                      threshold: [selectedVoteValue, 100],
                      requiredVotes,
                      option: "percentage",
                    }
                  : {
                      members: selectedGroup.members,
                      option: "number",
                      threshold: requiredVotes,
                      requiredVotes,
                    }
              }
            />
            <div className="d-flex gap-2 justify-content-end mt-3">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn theme-btn"
                onClick={() => {
                  setShowConfirmModal(false);
                  onSubmitClick();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="card rounded-4 d-flex flex-row px-0 flex-wrap">
        <div className="flex-1 border-right py-3">
          <div className="card-title px-3 pb-3">
            Permission Groups
            <Tooltip tooltip="Select the permission group you want to apply the voting threshold to.">
              <i className="bi bi-info-circle text-secondary ms-2"></i>
            </Tooltip>
          </div>
          <div className="d-flex flex-column gap-1 py-1">
            {rolesData.map((role, index) => {
              const name = role.roleName;
              const description = getRolesThresholdDescription(name);
              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedGroup(role);
                    const initialOption = role.isRatio
                      ? options[1]
                      : options[0];
                    reset({
                      voteOption: initialOption.value,
                      voteValue: role.threshold.toString(),
                    });
                  }}
                  className={
                    "py-2 cursor-pointer text-color " +
                    (name === selectedGroup.roleName
                      ? " selected-role bg-grey-04"
                      : "bg-transparent")
                  }
                >
                  <span className="px-3">{name}</span>
                  {description && (
                    <div className="text-secondary px-3 text-sm">
                      {description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 py-3 border-right">
          <div className="card-title px-3 pb-3">Voting Policy</div>
          <div className="d-flex flex-column gap-3 px-3 w-100 py-1">
            <div className="text-color">
              How many votes are needed for decisions in the `
              {selectedGroup.roleName}` permission group?
            </div>
            <div className="d-flex flex-column gap-1">
              <label className="proposal-label">Based On</label>
              <DropDown
                options={options}
                selectedValue={selectedVoteOption}
                onUpdate={(v) => {
                  setValue("voteOption", v.value, { shouldDirty: true });
                }}
                disabled={!hasCreatePermission}
              />
            </div>
            <div className="d-flex flex-column gap-1">
              <label className="proposal-label">
                {isPercentageSelected ? "Enter percentage" : "Value"}
              </label>
              <div className="position-relative">
                <input
                  className={`form-control flex-grow-1 ${
                    errors.voteValue ? "is-invalid" : ""
                  }`}
                  value={selectedVoteValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    setValue("voteValue", value, { shouldDirty: true });
                    const number = parseInt(value);
                    clearErrors("voteValue");

                    // Manual validation for immediate feedback
                    if (isPercentageSelected) {
                      if (number > 100) {
                        setError("voteValue", {
                          type: "manual",
                          message: "Maximum percentage allowed is 100.",
                        });
                      } else if (number < 1 && value !== "") {
                        setError("voteValue", {
                          type: "manual",
                          message: "The minimum allowed percentage is 1%.",
                        });
                      }
                    } else {
                      if (number > selectedGroup.members.length) {
                        setError("voteValue", {
                          type: "manual",
                          message: `Maximum members allowed is ${selectedGroup.members.length}.`,
                        });
                      } else if (number < 1 && value !== "") {
                        setError("voteValue", {
                          type: "manual",
                          message: "At least 1 member is required.",
                        });
                      }
                    }
                  }}
                  type="number"
                  min="0"
                  disabled={!hasCreatePermission}
                />
                {isPercentageSelected ? (
                  <i
                    className="bi bi-percent position-absolute"
                    style={{ right: "10px", top: "10px" }}
                  ></i>
                ) : (
                  <i
                    className="bi bi-person position-absolute"
                    style={{ right: "10px", top: "10px" }}
                  ></i>
                )}
              </div>
              {isPercentageSelected && (
                <div className="text-secondary text-sm">
                  This is equivalent to{" "}
                  <span className="fw-bolder">{requiredVotes} votes</span> with
                  the current number of members.
                </div>
              )}
              {errors.voteValue && (
                <div className="invalid-feedback d-block text-red">
                  {errors.voteValue.message}
                </div>
              )}
            </div>
            {isPercentageSelected &&
              selectedVoteValue &&
              selectedGroup.threshold !== parseInt(selectedVoteValue) && (
                <div
                  className="warning-box d-flex align-items-center gap-3 rounded-3 p-2"
                  style={{ fontSize: "13px" }}
                >
                  <i className="bi bi-exclamation-triangle h5 mb-0"></i>
                  <div>
                    If you choose a percentage-based threshold, the number of
                    votes required could change if new members are added or
                    existing members are removed. However, at least one vote
                    will always be required, regardless of the percentage.
                  </div>
                </div>
              )}

            {hasCreatePermission && (
              <div className="d-flex mt-2 gap-3 justify-content-end">
                <button
                  className="btn btn-outline-secondary shadow-none"
                  onClick={handleCancel}
                  disabled={!isDirty || isTxnCreated}
                >
                  Cancel
                </button>
                <InsufficientBannerModal
                  ActionButton={() => (
                    <button
                      className="btn theme-btn"
                      disabled={disableSubmit}
                      onClick={() => {
                        if (
                          !isPercentageSelected &&
                          selectedVoteValue > selectedGroup.members.length
                        ) {
                          setError("voteValue", {
                            type: "manual",
                            message: `Maximum members allowed is ${selectedGroup.members.length}.`,
                          });
                        } else {
                          if (proposals.length > 0) {
                            setShowWarningModal(true);
                          } else {
                            setShowConfirmModal(true);
                          }
                        }
                      }}
                    >
                      Submit Request
                    </button>
                  )}
                  checkForDeposit={true}
                  callbackAction={() => {
                    if (
                      !isPercentageSelected &&
                      selectedVoteValue > selectedGroup.members.length
                    ) {
                      setError("voteValue", {
                        type: "manual",
                        message: `Maximum members allowed is ${selectedGroup.members.length}.`,
                      });
                    } else {
                      if (proposals.length > 0) {
                        setShowWarningModal(true);
                      } else {
                        setShowConfirmModal(true);
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 py-3">
          <div className="card-title px-3 pb-3 d-flex align-items-center gap-2">
            <div>Who Can Vote</div>
            <span className="rounded-pill px-3 py-1 text-sm bg-grey-04">
              {selectedGroup.members.length}
            </span>
          </div>
          <div className="d-flex flex-column gap-1 py-1">
            {Array.isArray(selectedGroup.members) &&
              selectedGroup.members.map((member, index) => (
                <div
                  key={index}
                  className="p-1 px-3 text-truncate text-color"
                  style={{ width: "95%" }}
                >
                  <Profile accountId={member} showKYC={false} />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Thresholds;
