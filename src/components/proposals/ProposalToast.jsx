"use client";

import { useRouter, useSearchParams } from "next/navigation";

const ProposalToast = ({
  toastState,
  onClose,
  context = "request", // payment, stake, asset-exchange, function-call, etc.
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!toastState?.show || !toastState?.status) return null;

  const { status, proposalId } = toastState;

  // Get context-specific messages
  const getContextMessages = () => {
    const contextLabels = {
      payment: "payment request",
      stake: "request",
      "asset-exchange": "asset exchange request",
      "function-call": "function call request",
      settings: "proposal",
    };

    const label = contextLabels[context] || "request";

    return {
      InProgress: "Your vote is counted.",
      Approved: `The ${label} has been successfully executed.`,
      Rejected: `The ${label} has been rejected.`,
      Removed: `The ${label} has been successfully deleted.`,
      ProposalAdded: `${
        label.charAt(0).toUpperCase() + label.slice(1)
      } has been successfully created.`,
      StakeProposalAdded: "Stake request has been successfully created.",
      UnstakeProposalAdded: "Unstake request has been successfully created.",
      WithdrawProposalAdded: "Withdraw request has been successfully created.",
      ErrorAddingProposal: `Failed to create ${label}.`,
      ErrorVoting: `Failed to vote on ${label}. Please try again.`,
    };
  };

  const allMessages = getContextMessages();

  const getContent = () => {
    // Handle bulk import special case
    if (status?.startsWith("BulkProposalAdded")) {
      return `Successfully imported ${status.split(":")[1]} ${
        context === "payment" ? "payment requests" : "requests"
      }.`;
    }

    // Handle InProgress special case
    if (status === "InProgress") {
      return allMessages.InProgress;
    }

    return allMessages[status] || `The request is ${status}.`;
  };

  const showViewRequestLink = () => {
    // List of statuses that should show "View Request" link
    const viewRequestStatuses = [
      "ProposalAdded",
      "StakeProposalAdded",
      "UnstakeProposalAdded",
      "WithdrawProposalAdded",
    ];

    return (
      viewRequestStatuses.includes(status) &&
      proposalId !== null &&
      proposalId !== undefined
    );
  };

  const showViewHistoryLink = () => {
    // Don't show for these statuses
    const excludeStatuses = [
      "InProgress",
      "Removed",
      "ProposalAdded",
      "StakeProposalAdded",
      "UnstakeProposalAdded",
      "WithdrawProposalAdded",
      "ErrorAddingProposal",
      "ErrorVoting",
    ];

    // Don't show for bulk imports
    if (status?.startsWith("BulkProposalAdded")) return false;

    // Don't show if we're already on a proposal details page (id param exists)
    const currentId = searchParams.get("id");
    if (currentId !== null) return false;

    return (
      !excludeStatuses.includes(status) &&
      proposalId !== null &&
      proposalId !== undefined
    );
  };

  const handleViewClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set("id", proposalId);
    router.push(`?${params.toString()}`);
  };

  const getIcon = () => {
    if (status === "Approved") {
      return <i className="bi bi-check2 mb-0 success-icon"></i>;
    }
    if (status === "ErrorAddingProposal" || status === "ErrorVoting") {
      return <i className="bi bi-exclamation-octagon mb-0 error-icon"></i>;
    }
    return null;
  };

  return (
    <div className="toast-container position-fixed bottom-0 end-0 p-3">
      <div className={`toast ${toastState.show ? "show" : ""}`}>
        <div className="toast-header px-2">
          <strong className="me-auto">Just Now</strong>
          <i
            className="bi bi-x-lg h6 mb-0 cursor-pointer"
            onClick={onClose}
          ></i>
        </div>
        <div className="toast-body">
          <div className="d-flex align-items-center gap-3">
            {getIcon()}
            <div>
              {getContent()}
              <br />
              {showViewRequestLink() && (
                <a
                  className="text-underline cursor-pointer"
                  onClick={handleViewClick}
                >
                  View Request
                </a>
              )}
              {showViewHistoryLink() && (
                <a
                  className="text-underline cursor-pointer"
                  onClick={handleViewClick}
                >
                  View in History
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalToast;
