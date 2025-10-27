"use client";

import { decodeProposalDescription } from "@/helpers/daoHelpers";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";

const WarningTable = ({
  tableProps,
  warningText,
  descriptionText,
  includeExpiryDate,
}) => {
  return (
    <div className="d-flex flex-column gap-3 text-color">
      {warningText && (
        <div
          className="warning-box d-flex align-items-center gap-1 rounded-3 p-2"
          role="alert"
        >
          {warningText}
        </div>
      )}
      {descriptionText && <p className="mb-0">{descriptionText}</p>}
      {tableProps?.map(({ title, proposals, testId }, index) => (
        <div key={title || index} className="d-flex flex-column gap-2">
          {title && proposals.length > 0 && (
            <h6 className="text-secondary">{title}</h6>
          )}

          {proposals && proposals.length > 0 && (
            <div className="card overflow-auto">
              <table className="table table-simple">
                <thead>
                  <tr className="text-secondary">
                    <th>#</th>
                    <th>Created Date</th>
                    {includeExpiryDate && (
                      <>
                        <th>Expiry date</th>
                        <th>New expiry</th>
                      </>
                    )}
                    <th>Title</th>
                    <th>Created By</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((proposal) => (
                    <tr key={proposal.id} className="proposal-in-progress">
                      <td
                        className="fw-semi-bold px-3"
                        style={{ width: "55px" }}
                      >
                        {proposal.id}
                      </td>
                      <td style={{ width: "130px" }}>
                        <DateTimeDisplay
                          timestamp={
                            proposal.submissionTimeMillis
                              ? Number(proposal.submissionTimeMillis)
                              : Number(proposal.submission_time) / 1e6
                          }
                          format="date-time"
                        />
                      </td>
                      {includeExpiryDate && (
                        <>
                          <td style={{ width: "110px" }}>
                            <DateTimeDisplay
                              timestamp={proposal.currentExpiryTime}
                              format="date-time"
                            />
                          </td>
                          <td style={{ width: "110px" }}>
                            <DateTimeDisplay
                              timestamp={proposal.newExpiryTime}
                              format="date-time"
                            />
                          </td>
                        </>
                      )}
                      <td>
                        <div className="text-left text-clamp">
                          {decodeProposalDescription(
                            "title",
                            proposal.description
                          )}
                        </div>
                      </td>
                      <td>{proposal.proposer}</td>
                      <td className="text-center" style={{ width: "100px" }}>
                        <a
                          target="_blank"
                          href={`?id=${proposal.id}`}
                          className="btn btn-outline-secondary d-flex align-items-center"
                          rel="noopener noreferrer"
                        >
                          Details
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default WarningTable;
