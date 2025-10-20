"use client";

/**
 * Votes Component
 * Displays vote distribution with approve/reject counts and progress bar
 *
 * @param {Object} votes - Vote object with accountId => vote mapping
 * @param {number} requiredVotes - Number of votes required
 * @param {boolean} isInProgress - Whether proposal is still in progress
 * @param {boolean} isProposalDetailsPage - Whether shown on details page
 */
const Votes = ({
  votes = {},
  requiredVotes,
  isInProgress = false,
  isProposalDetailsPage = false,
}) => {
  const voteDistribution = { Approve: 0, Reject: 0 };
  Object.values(votes).forEach((vote) => {
    if (voteDistribution[vote] !== undefined) {
      voteDistribution[vote]++;
    }
  });

  const getPercentage = (value) =>
    value === 0 ? 0 : (value / requiredVotes) * 100;

  const approvePercentage = getPercentage(voteDistribution.Approve);
  const rejectPercentage = getPercentage(voteDistribution.Reject);

  return (
    <div
      className={
        "d-flex flex-column gap-1 " +
        (!isInProgress && " p-3 border border-1 rounded-4")
      }
      style={{
        width: isProposalDetailsPage ? "auto" : "100px",
        fontSize: "14px",
      }}
    >
      <div className="d-flex align-items-center px-2 gap-2">
        <div
          className="w-100 h-100 flex-1 fw-medium text-start"
          style={{ color: "var(--other-green)" }}
        >
          {voteDistribution.Approve} {isProposalDetailsPage && "Approved"}
        </div>
        {isProposalDetailsPage && (
          <div className="text-secondary text-xs">
            Required Votes: {requiredVotes}
          </div>
        )}
        <div
          className="w-100 h-100 flex-1 fw-medium text-end"
          style={{ color: "#dc6666" }}
        >
          {isProposalDetailsPage && "Rejected"} {voteDistribution.Reject}
        </div>
      </div>
      {isInProgress && (
        <div
          className="d-flex align-items-center rounded-pill overflow-hidden"
          style={{
            backgroundColor: "var(--grey-04)",
            width: "100%",
            height: "10px",
          }}
        >
          <div className="w-100 h-100 flex-1">
            <div
              className="h-100"
              style={{
                width: `${approvePercentage}%`,
                backgroundColor: "var(--other-green)",
              }}
            ></div>
          </div>
          {isProposalDetailsPage && <div className="vote-separator"></div>}
          <div className="w-100 h-100 flex-1">
            <div
              className="h-100"
              style={{
                width: `${rejectPercentage}%`,
                backgroundColor: "#dc6666",
                float: "inline-end",
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Votes;
