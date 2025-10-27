"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Approval from "@/components/icons/Approval";
import Reject from "@/components/icons/Reject";
import Tooltip from "@/components/ui/Tooltip";
import { getProfilesFromSocialDb } from "@/api/social";

const Approvers = ({
  votes = {},
  approversGroup = [],
  showApproversList = false,
  maxShow = 1,
}) => {
  const [profiles, setProfiles] = useState({});
  const fetchedAccountsRef = useRef(new Set());

  // Memoize the accounts and sorted approvers to prevent unnecessary re-renders
  const accounts = useMemo(() => Object.keys(votes), [votes]);
  const sortedApproversGroup = useMemo(
    () => [...approversGroup].sort((a, b) => a.localeCompare(b)),
    [approversGroup]
  );
  const allAccounts = useMemo(() => {
    return [...accounts, ...sortedApproversGroup];
  }, [accounts, sortedApproversGroup]);

  const allAccountsKey = allAccounts.join(",");

  const showHover = accounts?.length > maxShow;
  const maxIndex = 100;

  useEffect(() => {
    // Fetch profiles for all accounts
    const fetchProfiles = async () => {
      // Only fetch profiles for accounts we haven't fetched yet
      const accountsToFetch = allAccounts.filter(
        (account) => !fetchedAccountsRef.current.has(account)
      );

      if (accountsToFetch.length === 0) {
        return; // All accounts already fetched
      }

      // Mark these accounts as fetched
      accountsToFetch.forEach((account) =>
        fetchedAccountsRef.current.add(account)
      );

      try {
        // Fetch all profiles in a single API call (API handles caching)
        const fetchedProfiles = await getProfilesFromSocialDb(accountsToFetch);

        // Only update state if we got profile data with names
        setProfiles((prev) => {
          const hasNewData = Object.keys(fetchedProfiles).some(
            (accountId) => !prev[accountId]
          );

          if (!hasNewData) {
            return prev; // Don't trigger re-render if we already have all this data
          }

          return {
            ...prev,
            ...fetchedProfiles,
          };
        });
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    };

    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAccountsKey]);

  const getImage = (acc) => {
    return `https://i.near.social/magic/large/https://near.social/magic/img/account/${acc}`;
  };

  const ApproversComponent = (
    <div className="d-flex align-items-center">
      {accounts.slice(0, maxShow).map((acc, index) => {
        const imageSrc = getImage(acc);
        return (
          <div
            key={acc}
            className="position-relative rounded-circle"
            style={{
              marginLeft: index > 0 ? "-10px" : 0,
              zIndex: maxIndex - index,
              backgroundImage: `url("${imageSrc}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              height: "40px",
              width: "40px",
            }}
          >
            <div
              className="position-absolute"
              style={{ bottom: 0, right: "-5px" }}
            >
              {votes[acc] === "Approve" ? <Approval /> : <Reject />}
            </div>
          </div>
        );
      })}
      {accounts.length > maxShow && (
        <div
          style={{
            marginLeft: "-10px",
            width: "40px",
            height: "40px",
            backgroundColor: "var(--grey-04)",
          }}
          className="rounded-circle d-flex justify-content-center align-items-center"
        >
          +{accounts.length - maxShow}
        </div>
      )}
    </div>
  );

  const getVoteStatus = (vote) => {
    switch (vote) {
      case "Approve":
        return "Approved";
      case "Reject":
        return "Rejected";
      case "Remove":
        return "Deleted";
      default:
        return "";
    }
  };

  const approversList = (
    <div className={showApproversList ? "" : "p-1"}>
      <div className="d-flex flex-column gap-2">
        {(showApproversList ? accounts : sortedApproversGroup).map((acc) => {
          const profile = profiles[acc];
          const name = profile?.name;
          const imageSrc = getImage(acc);
          const voted = !!votes[acc];
          const votesStatus = getVoteStatus(votes[acc]);
          return (
            <div
              key={acc}
              className="d-flex gap-2 align-items-center"
              style={{
                color: voted ? "" : "#B3B3B3",
                opacity: voted ? "1" : "0.6",
              }}
            >
              <div>
                <div
                  className="position-relative rounded-circle"
                  style={{
                    backgroundImage: `url("${imageSrc}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    height: "40px",
                    width: "40px",
                  }}
                >
                  {voted && (
                    <div
                      className="position-absolute"
                      style={{ bottom: 0, right: "-5px" }}
                    >
                      {votes[acc] === "Approve" ? <Approval /> : <Reject />}
                    </div>
                  )}
                </div>
              </div>
              <div className="d-flex flex-column">
                <div className="h6 mb-0 text-break">{name ?? acc}</div>
                <div className="d-flex" style={{ fontSize: 12 }}>
                  {voted ? (
                    <span
                      style={{
                        color:
                          votesStatus === "Approved" ? "#3CB179" : "#D95C4A",
                      }}
                    >
                      {votesStatus}{" "}
                    </span>
                  ) : (
                    "Not Voted"
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return showApproversList ? (
    approversList
  ) : (
    <div className="d-flex justify-content-center">
      {showHover ? (
        <Tooltip tooltip={approversList}>{ApproversComponent}</Tooltip>
      ) : (
        ApproversComponent
      )}
    </div>
  );
};

export default Approvers;
