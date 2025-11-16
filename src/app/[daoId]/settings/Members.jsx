"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import Modal from "@/components/ui/Modal";
import OffCanvas from "@/components/ui/OffCanvas";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import Pagination from "@/components/ui/Pagination";
import TableSkeleton from "@/components/ui/TableSkeleton";
import Profile from "@/components/ui/Profile";
import AccountInput from "@/components/forms/AccountInput";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import { getProposalsFromIndexer } from "@/api/indexer";
import WarningTable from "./WarningTable";
import isEqual from "lodash/isEqual";
import cloneDeep from "lodash/cloneDeep";
import { REFRESH_DELAY } from "@/constants/ui";

const MembersEditor = ({
  isEdit,
  availableRoles,
  selectedMembers = [],
  initialValues = null,
  onSubmitClick,
  onCancel,
  disableCancel = false,
  isSubmitLoading = false,
}) => {
  const [members, setMembers] = useState(
    isEdit
      ? selectedMembers
      : initialValues
        ? [initialValues]
        : [{ member: "", roles: [] }]
  );
  const [rolesError, setRolesError] = useState("");
  const [accountValidity, setAccountValidity] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);

  const roleDescriptions = {
    Requestor:
      "Allows to create transaction requests (payments, stake delegation, and asset exchange).",
    Approver:
      "Allows to vote on transaction requests (payments, stake delegation, and asset exchange).",
    Admin:
      "Allows to both create and vote on treasury settings (members and permissions, voting policies and duration, and appearance).",
  };

  // Reset to empty member when switching from edit mode to add mode
  useEffect(() => {
    if (!isEdit && selectedMembers.length === 0) {
      setMembers(initialValues ? [initialValues] : [{ member: "", roles: [] }]);
    } else if (isEdit) {
      setMembers(selectedMembers);
    }
  }, [isEdit, selectedMembers, initialValues]);

  // Track if form has changes
  const hasChanges = useMemo(() => {
    if (!isEdit) {
      // In add mode, check if any member has data
      return members.some((m) => m.member || m.roles.length > 0);
    } else {
      // In edit mode, check if members have changed
      if (members.length !== selectedMembers.length) return true;

      const hasChanged = members.some((member, index) => {
        const originalMember = selectedMembers[index];
        if (!originalMember) return true;

        // Compare member IDs
        if (member.member !== originalMember.member) return true;

        // Compare roles using isEqual (handles order differences)
        const currentRoles = [...member.roles].sort();
        const originalRoles = [...originalMember.roles].sort();

        return !isEqual(currentRoles, originalRoles);
      });

      return hasChanged;
    }
  }, [members, selectedMembers, isEdit]);

  const handleAddMember = () => {
    setMembers([...members, { member: "", roles: [] }]);
    // Reset validity state for re-indexed members
    const newValidity = {};
    members.forEach((_, i) => {
      if (accountValidity[i] !== undefined) {
        newValidity[i] = accountValidity[i];
      }
    });
    setAccountValidity(newValidity);
  };

  const handleRemoveMember = (index) => {
    setMembers(members.filter((_, i) => i !== index));
    // Update validity state to reflect new indices
    const newValidity = {};
    members.forEach((_, i) => {
      if (i > index && accountValidity[i] !== undefined) {
        newValidity[i - 1] = accountValidity[i];
      } else if (i < index && accountValidity[i] !== undefined) {
        newValidity[i] = accountValidity[i];
      }
    });
    setAccountValidity(newValidity);
  };

  const handleAccountChange = (index, accountId) => {
    const updated = [...members];
    updated[index].member = accountId;
    setMembers(updated);
  };

  const handleSubmit = () => {
    // Validate that all members have at least one role
    const hasEmptyRoles = members.some((m) => m.roles.length === 0);
    if (hasEmptyRoles) {
      setRolesError("Each member must have at least one role assigned.");
      return;
    }

    // Validate that all members have account IDs
    const hasEmptyAccounts = members.some((m) => !m.member);
    if (hasEmptyAccounts) {
      setRolesError("All members must have valid account IDs.");
      return;
    }

    // Validate that all account IDs are valid
    if (!isEdit) {
      const hasInvalidAccounts = members.some(
        (m, index) => accountValidity[index] === false
      );
      if (hasInvalidAccounts) {
        setRolesError(
          "Please ensure all account IDs are valid before submitting."
        );
        return;
      }
    }

    setRolesError("");
    onSubmitClick(members);
  };

  return (
    <div className="d-flex flex-column gap-3">
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
                onCancel();
              }}
            >
              Yes
            </button>
          </>
        }
      >
        <div>
          This action will discard all the information you have entered in the
          form and cannot be undone.
        </div>
      </Modal>
      <div className="d-flex flex-column gap-3">
        {members.map((member, index) => (
          <div key={index} className="member-container">
            {/* Header Section - Different for add vs edit */}
            <div
              className="custom-header px-3 rounded-3"
              style={{ height: isEdit ? "70px" : "55px" }}
            >
              {isEdit ? (
                <div
                  className="d-flex gap-2 align-items-center"
                  style={{ paddingTop: "14px" }}
                >
                  <Profile
                    accountId={member.member}
                    imageSize={{ width: 30, height: 30 }}
                    displayName={false}
                    displayHoverCard={false}
                  />
                </div>
              ) : (
                <div
                  className="d-flex justify-content-between align-items-center"
                  style={{ paddingTop: "12px" }}
                >
                  <span className="h6 mb-0">Member #{index + 1}</span>
                  {index !== 0 && (
                    <i
                      className="bi bi-trash3 h6 mb-0 text-red"
                      onClick={() => handleRemoveMember(index)}
                      style={{ cursor: "pointer" }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Content Section */}
            <div
              className="card p-3 border-top-0 rounded-top-0"
              style={{ marginTop: isEdit ? "-20px" : "-15px" }}
            >
              <div className="d-flex flex-column gap-3">
                {!isEdit && (
                  <div>
                    <label className="mb-2 d-block fw-semibold text-color">
                      Username
                    </label>
                    <AccountInput
                      placeholder="Enter account ID"
                      value={member.member}
                      onUpdate={(accountId) =>
                        handleAccountChange(index, accountId)
                      }
                      setParentAccountValid={(isValid) => {
                        setAccountValidity((prev) => ({
                          ...prev,
                          [index]: isValid,
                        }));
                      }}
                      disabled={isSubmitLoading}
                    />
                  </div>
                )}
                <div>
                  <label
                    className={
                      "mb-2 d-block fw-semibold text-color " +
                      (isEdit ? "mt-2" : "")
                    }
                  >
                    Permissions
                  </label>
                  <div className="d-flex flex-wrap gap-1 align-items-center">
                    {member.roles.map((roleValue) => {
                      const role = availableRoles.find(
                        (r) => r.value === roleValue
                      );
                      // Display custom roles as well as predefined ones
                      // Capitalize first letter for custom roles
                      const displayTitle = role
                        ? role.title
                        : roleValue.charAt(0).toUpperCase() +
                          roleValue.slice(1);

                      return (
                        <span key={roleValue} className="badge">
                          {displayTitle}
                          <i
                            className="bi bi-x-lg"
                            onClick={() => {
                              const updated = members.map((m, i) =>
                                i === index
                                  ? {
                                      ...m,
                                      roles: m.roles.filter(
                                        (r) => r !== roleValue
                                      ),
                                    }
                                  : m
                              );
                              setMembers(updated);
                              setRolesError("");
                            }}
                          />
                        </span>
                      );
                    })}
                    {/* Show dropdown only if there are predefined roles not yet selected */}
                    {availableRoles.some(
                      (role) => !member.roles.includes(role.value)
                    ) && (
                      <div className="dropdown">
                        <button
                          className="select-tag d-flex gap-1 align-items-center"
                          type="button"
                          data-bs-toggle="dropdown"
                          disabled={isSubmitLoading}
                        >
                          <i className="bi bi-plus-lg h5 mb-0" /> Add Permission
                        </button>
                        <ul
                          className="dropdown-menu rounded-2 px-2"
                          style={{ minWidth: "350px" }}
                        >
                          {availableRoles
                            .filter(
                              (role) => !member.roles.includes(role.value)
                            )
                            .map((role) => (
                              <li key={role.value}>
                                <a
                                  className="dropdown-item cursor-pointer w-100 my-1"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const updated = members.map((m, i) =>
                                      i === index
                                        ? {
                                            ...m,
                                            roles: [...m.roles, role.value],
                                          }
                                        : m
                                    );
                                    setMembers(updated);
                                    setRolesError("");
                                  }}
                                >
                                  <div>{role.title}</div>
                                  {roleDescriptions[role.value] && (
                                    <div className="text-secondary text-sm text-wrap">
                                      {roleDescriptions[role.value]}
                                    </div>
                                  )}
                                </a>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isEdit && (
        <button
          className="btn btn-outline-secondary"
          onClick={handleAddMember}
          disabled={isSubmitLoading}
        >
          + Add Another Member
        </button>
      )}

      {rolesError && (
        <div
          className="error-box d-flex gap-2 align-items-center p-2 rounded-2"
          role="alert"
        >
          <i className="bi bi-exclamation-octagon text-danger h5 mb-0"></i>
          {rolesError}
        </div>
      )}

      <div className="d-flex justify-content-end gap-2 align-items-center">
        <button
          className="btn btn-outline-secondary"
          onClick={() => {
            if (hasChanges) {
              setShowCancelModal(true);
            } else {
              onCancel();
            }
          }}
          disabled={disableCancel || isSubmitLoading}
        >
          Cancel
        </button>
        <button
          className="btn primary-button"
          onClick={handleSubmit}
          disabled={isSubmitLoading}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

const Members = () => {
  const { daoId, daoPolicy, hasPermission } = useDao();
  const { accountId, signAndSendTransactions } = useNearWallet();
  const { showToast } = useProposalToastContext();
  const searchParams = useSearchParams();

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [allMembers, setAllMembers] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState(null);
  const [
    showProposalsOverrideConfirmModal,
    setShowProposalsOverrideConfirmModal,
  ] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [emptyRolesError, setEmptyRolesError] = useState([]);

  const data = useMemo(() => {
    return allMembers.slice(
      currentPage * rowsPerPage,
      currentPage * rowsPerPage + rowsPerPage
    );
  }, [currentPage, rowsPerPage, allMembers]);

  const hasCreatePermission = hasPermission?.("policy", "AddProposal") ?? false;

  // Handle URL parameters to auto-open and pre-fill add member form
  useEffect(() => {
    if (!searchParams || !hasCreatePermission || loading) return;

    const memberParam = searchParams.get("member");
    const permissionsParam = searchParams.get("permissions");

    if (memberParam && permissionsParam) {
      // Map common role names (case-insensitive) to proper capitalization
      const roleMapping = {
        requestor: "Requestor",
        approver: "Approver",
        admin: "Admin",
      };

      // Accept any permission value from URL (comma-separated)
      const permissions = permissionsParam
        .split(",")
        .map((p) => {
          const trimmed = p.trim();
          // Check if it's a known role (case-insensitive)
          const knownRole = roleMapping[trimmed.toLowerCase()];
          return knownRole || trimmed;
        })
        .filter(Boolean);

      if (permissions.length > 0) {
        setInitialFormValues({
          member: memberParam,
          roles: permissions,
        });
        setIsEdit(false);
        setShowEditor(true);
      }
    }
  }, [searchParams, hasCreatePermission, loading]);

  // Helper functions
  const getMembersAndPermissions = () => {
    if (!daoPolicy || !Array.isArray(daoPolicy.roles)) {
      return [];
    }

    const memberRolesMap = new Map();

    daoPolicy.roles.forEach((role) => {
      if (role.kind && role.kind.Group && Array.isArray(role.kind.Group)) {
        role.kind.Group.forEach((member) => {
          if (!memberRolesMap.has(member)) {
            memberRolesMap.set(member, []);
          }
          memberRolesMap.get(member).push(role.name);
        });
      }
    });

    const members = Array.from(memberRolesMap.entries()).map(
      ([member, roles]) => ({
        member,
        roles,
      })
    );

    return members;
  };

  const getDaoRoles = () => {
    if (!daoPolicy || !Array.isArray(daoPolicy.roles)) {
      return [];
    }

    const roles = daoPolicy.roles
      .map((role) => role.name)
      .filter((name, index, self) => self.indexOf(name) === index)
      .filter((name) => name !== "all");

    return roles;
  };

  const updateDaoPolicyLocal = (memberList, isEdit = false) => {
    if (!daoPolicy || !Array.isArray(daoPolicy.roles)) {
      return { updatedPolicy: daoPolicy, summary: "" };
    }

    const summaryLines = memberList.map(({ member, roles }) => {
      if (isEdit) {
        return `- edit "${member}" to [${roles
          .map((r) => `"${r}"`)
          .join(", ")}]`;
      } else {
        return `- add "${member}" to [${roles
          .map((r) => `"${r}"`)
          .join(", ")}]`;
      }
    });

    const updatedPolicy = cloneDeep(daoPolicy);

    // Update roles
    updatedPolicy.roles = updatedPolicy.roles.map((role) => {
      const roleName = role.name;

      if (isEdit) {
        // For edit mode: check each member in memberList
        let newGroup = [...(role.kind.Group || [])];
        memberList.forEach(({ member, roles }) => {
          const shouldHaveRole = roles.includes(roleName);
          const isInRole = newGroup.includes(member);
          if (shouldHaveRole && !isInRole) {
            newGroup.push(member);
          } else if (!shouldHaveRole && isInRole) {
            newGroup = newGroup.filter((m) => m !== member);
          }
        });
        role.kind.Group = newGroup;
      } else {
        // For add mode: add members to roles they have
        const membersToAdd = memberList.filter((m) =>
          m.roles.includes(roleName)
        );
        const existingGroup = [...(role.kind.Group || [])];
        membersToAdd.forEach(({ member }) => {
          if (!existingGroup.includes(member)) {
            existingGroup.push(member);
          }
        });
        role.kind.Group = existingGroup;
      }
      return role;
    });

    const summary = summaryLines.join("\n");
    return { updatedPolicy, summary };
  };

  const removeMembersFromPolicy = (membersToRemove) => {
    if (!daoPolicy || !Array.isArray(daoPolicy.roles)) {
      return { updatedPolicy: daoPolicy, summary: "", emptyRoles: [] };
    }

    const emptyRoles = [];
    const summaryLines = membersToRemove.map(({ member, roles }) => {
      return `- remove "${member}" from [${roles
        .map((r) => `"${r}"`)
        .join(", ")}]`;
    });

    const memberIdsToRemove = membersToRemove.map((m) => m.member);

    const updatedPolicy = cloneDeep(daoPolicy);

    // Update roles
    updatedPolicy.roles.forEach((role) => {
      const originalGroup = role.kind.Group || [];
      role.kind.Group = originalGroup.filter(
        (m) => !memberIdsToRemove.includes(m)
      );

      // Check if this role would become empty
      if (originalGroup.length > 0 && role.kind.Group.length === 0) {
        emptyRoles.push(role.name);
      }
    });

    const summary = summaryLines.join("\n");
    return { updatedPolicy, summary, emptyRoles };
  };

  // Fetch members and roles
  useEffect(() => {
    if (daoPolicy && daoPolicy.roles) {
      const members = getMembersAndPermissions();
      const roles = getDaoRoles();
      setAllMembers(members);
      setAvailableRoles(roles.map((r) => ({ title: r, value: r })));
      setLoading(false);
    } else {
      setLoading(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daoPolicy]);

  const checkProposals = async () => {
    try {
      const result = await getProposalsFromIndexer({
        daoId,
        proposalType: ["ChangePolicy"],
        statuses: ["InProgress"],
      });
      setProposals(result.proposals || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      setProposals([]);
    }
  };

  // Check for pending proposals
  useEffect(() => {
    if (daoId && hasCreatePermission) {
      checkProposals();
    }
  }, [daoId, hasCreatePermission]);

  function getImage(acc) {
    return `https://i.near.social/magic/large/https://near.social/magic/img/account/${acc}`;
  }

  const MembersTable = () => {
    return (
      <tbody>
        {data?.map((group, index) => {
          const account = group.member;
          const imageSrc = getImage(account);
          return (
            <tr key={index} className="member-row">
              {hasCreatePermission && (
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    role="switch"
                    disabled={isTxnCreated || showEditor || showDeleteModal}
                    checked={selectedRows.includes(account)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows([...selectedRows, account]);
                      } else {
                        setSelectedRows(
                          selectedRows.filter((id) => id !== account)
                        );
                      }
                    }}
                  />
                </td>
              )}
              <td>
                <div className="d-flex gap-2 align-items-center">
                  <img
                    src={imageSrc}
                    height={30}
                    width={30}
                    className="rounded-circle"
                    alt={account}
                  />
                  <Profile
                    accountId={account}
                    displayImage={false}
                    displayName={true}
                    displayHoverCard={false}
                  />
                </div>
              </td>
              <td>
                <Profile
                  accountId={account}
                  displayImage={false}
                  displayName={false}
                  profileClass="text-secondary text-sm"
                />
              </td>
              <td>
                <div className="d-flex gap-3 align-items-center justify-content-between">
                  <div className="d-flex gap-3 align-items-center flex-wrap">
                    {(group.roles ?? []).map((role, idx) => (
                      <span key={idx} className="badge">
                        {role}
                      </span>
                    ))}
                  </div>
                  {hasCreatePermission && (
                    <div className="action-buttons d-flex">
                      <button
                        className="action-btn border-0 bg-transparent rounded p-1"
                        disabled={isTxnCreated || showEditor || showDeleteModal}
                        onClick={(e) => {
                          e.stopPropagation();
                          checkAndExecuteAction({
                            type: "editSingle",
                            account,
                          });
                        }}
                        title="Edit member"
                      >
                        <i className="bi bi-pencil h5 mb-0"></i>
                      </button>
                      <button
                        className="action-btn border-0 bg-transparent rounded p-1 text-danger"
                        disabled={isTxnCreated || showEditor || showDeleteModal}
                        onClick={(e) => {
                          e.stopPropagation();
                          checkAndExecuteAction({
                            type: "deleteSingle",
                            account,
                          });
                        }}
                        title="Delete member"
                      >
                        <i className="bi bi-trash3 h5 mb-0"></i>
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    );
  };

  const checkAndExecuteAction = (action) => {
    if (proposals.length > 0) {
      setPendingAction(action);
      setShowProposalsOverrideConfirmModal(true);
    } else {
      executeAction(action);
    }
  };

  const executeAction = (action) => {
    switch (action.type) {
      case "add":
        setSelectedMembers([]);
        setIsEdit(false);
        setShowEditor(true);
        break;
      case "edit":
        const members = allMembers.filter((m) =>
          selectedRows.includes(m.member)
        );
        setSelectedMembers(members);
        setIsEdit(true);
        setShowEditor(true);
        break;
      case "delete":
        const deleteMembers = allMembers.filter((m) =>
          selectedRows.includes(m.member)
        );
        // Validate if removing these members would leave roles empty
        const { emptyRoles } = removeMembersFromPolicy(deleteMembers);
        setEmptyRolesError(emptyRoles);
        setSelectedMembers(deleteMembers);
        setShowDeleteModal(true);
        break;
      case "editSingle":
        const member = allMembers.find((m) => m.member === action.account);
        setSelectedMembers([member]);
        setIsEdit(true);
        setShowEditor(true);
        break;
      case "deleteSingle":
        const deleteMember = allMembers.find(
          (m) => m.member === action.account
        );
        // Validate if removing this member would leave roles empty
        const { emptyRoles: singleEmptyRoles } = removeMembersFromPolicy([
          deleteMember,
        ]);
        setEmptyRolesError(singleEmptyRoles);
        setSelectedMembers([deleteMember]);
        setShowDeleteModal(true);
        break;
    }
  };

  const handleEditorSubmit = async (list) => {
    if (!daoPolicy) return;

    setTxnCreated(true);

    try {
      const changes = updateDaoPolicyLocal(list, isEdit);
      const description = {
        title: isEdit
          ? "Update Policy - Edit Members Permissions"
          : "Update Policy - Add New Members",
        summary: changes.summary,
      };

      const result = await signAndSendTransactions({
        transactions: [
          {
            receiverId: daoId,
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
                          policy: changes.updatedPolicy,
                        },
                      },
                    },
                  },
                  gas: "300000000000000",
                  deposit: daoPolicy?.proposal_bond || "0",
                },
              },
            ],
          },
        ],
      });

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        checkProposals();
        showToast("ProposalAdded", null, "settings");

        setTimeout(() => {
          setShowEditor(false);
          setTxnCreated(false);
          setSelectedRows([]);
          setSelectedMembers([]);
        }, REFRESH_DELAY);
      }
    } catch (error) {
      console.error("Error creating proposal:", error);
      showToast("ErrorAddingProposal", null, "settings");
      setTxnCreated(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!daoPolicy) return;

    setTxnCreated(true);

    try {
      const changes = removeMembersFromPolicy(selectedMembers);
      const description = {
        title: "Update Policy - Remove Members",
        summary: `${accountId} requested the following removals:\n${changes.summary}`,
      };

      const result = await signAndSendTransactions({
        transactions: [
          {
            receiverId: daoId,
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
                          policy: changes.updatedPolicy,
                        },
                      },
                    },
                  },
                  gas: "300000000000000",
                  deposit: daoPolicy?.proposal_bond || "0",
                },
              },
            ],
          },
        ],
      });

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        checkProposals();
        showToast("ProposalAdded", null, "settings");

        setTimeout(() => {
          setShowDeleteModal(false);
          setTxnCreated(false);
          setSelectedRows([]);
          setSelectedMembers([]);
        }, REFRESH_DELAY);
      }
    } catch (error) {
      console.error("Error creating proposal:", error);
      showToast("ErrorAddingProposal", null, "settings");
      setTxnCreated(false);
    }
  };

  return (
    <div
      className="d-flex flex-column"
      style={{ fontSize: "13px", minHeight: "75vh" }}
    >
      <TransactionLoader showInProgress={isTxnCreated} />

      {/* Proposals Override Confirmation Modal */}
      {showProposalsOverrideConfirmModal && (
        <Modal
          size="lg"
          isOpen={showProposalsOverrideConfirmModal}
          heading={
            <div className="d-flex gap-2 align-items-center">
              <i className="bi bi-exclamation-triangle text-warning h5 mb-0"></i>
              Resolve Before Proceeding
            </div>
          }
          onClose={() => setShowProposalsOverrideConfirmModal(false)}
        >
          <WarningTable
            tableProps={[
              {
                proposals: proposals,
              },
            ]}
            warningText="To avoid conflicts, you need to complete or resolve the existing pending requests before proceeding. These requests are currently active and must be approved or rejected first.."
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedMembers?.length > 0 && (
        <Modal
          isOpen={showDeleteModal}
          heading={
            emptyRolesError.length > 0 ? (
              <div className="d-flex gap-2 align-items-center">
                <i className="bi bi-exclamation-octagon text-danger h5 mb-0"></i>
                <span>Invalid Role Change</span>
              </div>
            ) : (
              "Are you sure?"
            )
          }
          onClose={() => {
            setShowDeleteModal(false);
            setEmptyRolesError([]);
          }}
          footer={
            <div className="d-flex gap-2 justify-content-end">
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setEmptyRolesError([]);
                }}
                disabled={isTxnCreated}
              >
                {emptyRolesError.length > 0 ? "Close" : "Cancel"}
              </button>
              {emptyRolesError.length === 0 && (
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteConfirm}
                  disabled={isTxnCreated}
                >
                  Remove
                </button>
              )}
            </div>
          }
        >
          {emptyRolesError.length > 0 ? (
            <>
              <p>
                The following roles would be left with{" "}
                <strong>no members</strong> if you proceed:
              </p>
              <ul>
                {emptyRolesError.map((role) => (
                  <li key={role}>{role}</li>
                ))}
              </ul>
              <p>
                Please adjust the selection to retain at least one member per
                role.
              </p>
            </>
          ) : (
            <>
              {selectedMembers.length === 1 ? (
                <p>
                  {selectedMembers[0].member} will lose their permissions to
                  this treasury once the request is created and approved.
                </p>
              ) : (
                <>
                  <p>
                    The following members will lose their permissions to this
                    treasury once the request is created and approved:
                  </p>
                  <ul>
                    {selectedMembers.map((member) => (
                      <li key={member.member}>{member.member}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Modal>
      )}

      {/* Members Editor OffCanvas */}
      <OffCanvas
        showCanvas={showEditor}
        onClose={() => {
          setShowEditor(false);
          setInitialFormValues(null);
        }}
        disableScroll={true}
        title={isEdit ? "Edit Members" : "Add Members"}
      >
        <MembersEditor
          isEdit={isEdit}
          availableRoles={availableRoles}
          selectedMembers={selectedMembers}
          initialValues={initialFormValues}
          onSubmitClick={handleEditorSubmit}
          onCancel={() => {
            setShowEditor(false);
            setInitialFormValues(null);
          }}
          disableCancel={isTxnCreated}
          isSubmitLoading={isTxnCreated}
        />
      </OffCanvas>

      {/* Main Members Table */}
      <div className="card rounded-4 py-3 d-flex flex-column flex-1 w-100">
        <div className="d-flex justify-content-between gap-2 align-items-center border-bottom px-3 pb-3">
          <div className="fw-semibold text-color" style={{ fontSize: "20px" }}>
            All Members
          </div>
          {hasCreatePermission &&
            !loading &&
            (selectedRows.length === 0 ? (
              <InsufficientBannerModal
                ActionButton={({ onClick }) => (
                  <button
                    className="btn primary-button d-flex align-items-center gap-2"
                    disabled={showEditor || showDeleteModal || isTxnCreated}
                    onClick={onClick}
                  >
                    <i className="bi bi-plus-lg h5 mb-0"></i>Add Members
                  </button>
                )}
                checkForDeposit={true}
                callbackAction={() => checkAndExecuteAction({ type: "add" })}
                disabled={showEditor || showDeleteModal || isTxnCreated}
              />
            ) : (
              <div className="d-flex gap-3">
                <InsufficientBannerModal
                  ActionButton={({ onClick }) => (
                    <button
                      className="btn btn-outline-secondary d-flex gap-1 align-items-center"
                      disabled={showEditor || showDeleteModal || isTxnCreated}
                      onClick={onClick}
                    >
                      <i className="bi bi-pencil" />
                      Edit
                    </button>
                  )}
                  checkForDeposit={true}
                  callbackAction={() => checkAndExecuteAction({ type: "edit" })}
                  disabled={showEditor || showDeleteModal || isTxnCreated}
                />
                <InsufficientBannerModal
                  ActionButton={({ onClick }) => (
                    <button
                      className="btn btn-outline-danger d-flex gap-1 align-items-center"
                      disabled={showEditor || showDeleteModal || isTxnCreated}
                      onClick={onClick}
                    >
                      <i className="bi bi-trash3" />
                      Delete
                    </button>
                  )}
                  checkForDeposit={true}
                  callbackAction={() =>
                    checkAndExecuteAction({ type: "delete" })
                  }
                  disabled={showEditor || showDeleteModal || isTxnCreated}
                />
              </div>
            ))}
        </div>
        <div
          className="d-flex flex-column flex-1 justify-content-between"
          style={{ overflow: "auto" }}
        >
          <table className="table">
            <thead>
              <tr className="text-secondary">
                {hasCreatePermission && (
                  <td>
                    <input
                      type="checkbox"
                      className={`form-check-input ${
                        selectedRows.length > 0 &&
                        selectedRows.length < allMembers.length
                          ? "indeterminate"
                          : ""
                      }`}
                      role="switch"
                      disabled={isTxnCreated || showEditor || showDeleteModal}
                      checked={
                        selectedRows.length === allMembers.length &&
                        allMembers.length > 0
                      }
                      onChange={(e) => {
                        if (selectedRows.length === 0 && e.target.checked) {
                          setSelectedRows(
                            allMembers.map((item) => item.member)
                          );
                        } else {
                          setSelectedRows([]);
                        }
                        setSelectedMembers([]);
                      }}
                    />
                  </td>
                )}
                <td>
                  {selectedRows.length > 0 ? (
                    <>{selectedRows.length} Members Selected</>
                  ) : (
                    "Name"
                  )}
                </td>
                <td>User name</td>
                <td>Permission Group(s)</td>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <TableSkeleton
                  numberOfCols={4}
                  numberOfRows={3}
                  numberOfHiddenRows={4}
                />
              </tbody>
            ) : (
              <MembersTable />
            )}
          </table>
          <Pagination
            totalLength={allMembers?.length}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            onNextClick={() => setCurrentPage(currentPage + 1)}
            onPrevClick={() => setCurrentPage(currentPage - 1)}
            onRowsChange={(v) => {
              setCurrentPage(0);
              setRowsPerPage(parseInt(v));
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Members;
