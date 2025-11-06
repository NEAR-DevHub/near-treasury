"use client";

/**
 * HistoryStatus Component
 * Displays proposal or vote status with appropriate styling
 *
 * @param {boolean} isVoteStatus - Whether this is a vote status or proposal status
 * @param {string} status - The status to display
 * @param {boolean} isPaymentsPage - Whether this is on the payments page
 */
const HistoryStatus = ({ status, isPaymentsPage = false }) => {
  // Map status to appropriate CSS class
  const getStatusClass = (status) => {
    if (status === "Approved") return "approve-status";
    if (status === "Rejected") return "reject-status";
    if (status === "Failed") return "failed-status";
    return "expire-status";
  };

  // Display label transformation
  const getDisplayLabel = () => {
    if (status === "InProgress") {
      return "Expired";
    }
    return status;
  };

  return (
    <div className="d-flex justify-content-center align-items-center w-100">
      <div className={`status-badge ${getStatusClass(status)}`}>
        {getDisplayLabel()}
      </div>
    </div>
  );
};

export default HistoryStatus;
