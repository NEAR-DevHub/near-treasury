"use client";

/**
 * ProposalStatus Component
 * Displays user's vote status badge (Approved/Rejected/Deleted)
 *
 * @param {string} status - Vote status: "Approve", "Reject", or "Remove"
 * @param {boolean} hasOneDeleteIcon - Whether to add spacing for delete icon
 * @param {boolean} hasFullWidth - Whether to take full width
 */
const ProposalStatus = ({
  status,
  hasOneDeleteIcon = false,
  hasFullWidth = false,
}) => {
  return (
    <div className={"d-flex " + (hasFullWidth && "w-100")}>
      {status === "Approve" ? (
        <div
          className={
            "d-flex gap-2 align-items-center approve-status rounded-2 p-2 " +
            (hasFullWidth && "w-100")
          }
        >
          <i className="bi bi-check2"></i>
          You Approved
        </div>
      ) : (
        <div
          className={
            "d-flex gap-2 align-items-center reject-status rounded-2 p-2 " +
            (hasFullWidth && "w-100")
          }
        >
          <i className="bi bi-x"></i>
          You {status === "Reject" ? "Rejected" : "Deleted"}
        </div>
      )}
      {hasOneDeleteIcon && <div style={{ minWidth: 36 }}></div>}
    </div>
  );
};

export default ProposalStatus;
