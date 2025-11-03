"use client";

import { useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposal } from "@/hooks/useProposal";
import { decodeProposalDescription, decodeBase64 } from "@/helpers/daoHelpers";
import Big from "big.js";
import ProposalDetails from "@/components/proposals/ProposalDetails";
import VoteActions from "@/components/proposals/VoteActions";
import Profile from "@/components/ui/Profile";
import { logger } from "@/helpers/logger";

const SettingsProposalDetailsPage = ({ id, isCompactVersion, onClose }) => {
  const { accountId } = useNearWallet();
  const { daoPolicy, getApproversAndThreshold } = useDao();

  const { proposal: rawProposal, isError: isDeleted } = useProposal(id);

  const [proposalData, setProposalData] = useState(null);

  const settingsApproverGroup = getApproversAndThreshold("policy");
  const deleteGroup = getApproversAndThreshold("policy", true);
  const requiredVotes = settingsApproverGroup?.requiredVotes;

  const hasVotingPermission = (
    settingsApproverGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  const proposalPeriod = daoPolicy?.proposal_period || 0;

  const RequestType = {
    MEMBERS: "Members",
    VOTING_THRESHOLD: "Voting Threshold",
    VOTING_DURATION: "Voting Duration",
    THEME: "Theme",
    OTHER: "Settings",
  };

  // Process raw proposal data when it changes
  useEffect(() => {
    const processProposalData = async () => {
      if (!rawProposal || !proposalPeriod) return;

      try {
        const item = rawProposal;

        const title = decodeProposalDescription("title", item.description);
        const summary = decodeProposalDescription("summary", item.description);

        let requestType = RequestType.OTHER;

        if (
          ((title ?? "").includes("Add New Members") ||
            (title ?? "").includes("Edit Members Permissions") ||
            (title ?? "").includes("Remove Members") ||
            (title ?? "").includes("Members Permissions")) &&
          !(summary ?? "").includes("revoke")
        ) {
          requestType = RequestType.MEMBERS;
        } else if ((title ?? "").includes("Voting Thresholds")) {
          requestType = RequestType.VOTING_THRESHOLD;
        } else if ((title ?? "").includes("Voting Duration")) {
          requestType = RequestType.VOTING_DURATION;
        } else if ((title ?? "").includes("Theme & logo")) {
          requestType = RequestType.THEME;
        }

        let status = item.status;
        if (status === "InProgress") {
          const endTime = Big(item.submission_time ?? "0")
            .plus(proposalPeriod ?? "0")
            .toFixed();
          const timestampInMilliseconds = Big(endTime) / Big(1_000_000);
          const currentTimeInMilliseconds = Date.now();
          if (Big(timestampInMilliseconds).lt(currentTimeInMilliseconds)) {
            status = "Expired";
          }
        }

        setProposalData({
          id: item.id,
          proposer: item.proposer,
          votes: item.votes,
          submissionTime: item.submission_time,
          status,
          kind: item.kind,
          title,
          summary,
          requestType,
          proposal: item,
        });
      } catch (error) {
        logger.error("Error processing proposal data:", error);
      }
    };

    processProposalData();
  }, [rawProposal, proposalPeriod]);

  const parseMembersSummary = (text) => {
    if (!text) return [];
    const lines = text.split("\n").filter((line) => line.trim());
    const members = [];

    for (const line of lines) {
      let match;

      // Match: - add "alice" to ["Admin", "Editor"]
      if ((match = line.match(/- add "([^"]+)" to \[(.*?)\]/))) {
        members.push({
          member: match[1],
          oldRoles: [],
          newRoles: match[2]
            .match(/"([^"]+)"/g)
            .map((r) => r.replace(/"/g, "")),
          type: "add",
        });
      }
      // Match: - remove "bob" from ["Viewer"]
      else if ((match = line.match(/- remove "([^"]+)" from \[(.*?)\]/))) {
        members.push({
          member: match[1],
          oldRoles: match[2]
            .match(/"([^"]+)"/g)
            .map((r) => r.replace(/"/g, "")),
          newRoles: [],
          type: "remove",
        });
      }
      // Match: - edit "charlie" from ["Editor"] to ["Admin", "Finance"]
      else if (
        (match = line.match(/- edit "([^"]+)" from \[(.*?)\] to \[(.*?)\]/))
      ) {
        members.push({
          member: match[1],
          oldRoles: match[2]
            .match(/"([^"]+)"/g)
            .map((r) => r.replace(/"/g, "")),
          newRoles: match[3]
            .match(/"([^"]+)"/g)
            .map((r) => r.replace(/"/g, "")),
          type: "edit",
        });
      }
      // Fallback to old style: requested to (add|remove) "member" (to|from) roles
      else {
        const fallback = line.match(
          /requested to (add|remove) "([^"]+)" (?:to|from) (.+)$/
        );
        if (fallback) {
          const isAdd = fallback[1] === "add";
          const member = fallback[2];
          const roles = [...fallback[3].matchAll(/"([^"]+)"/g)].map(
            (m) => m[1]
          );
          members.push({
            member,
            oldRoles: isAdd ? [] : roles,
            newRoles: isAdd ? roles : [],
            type: isAdd ? "add" : "remove",
          });
        }
      }
    }

    return members;
  };

  const getOldAndNewValues = () => {
    if (!proposalData?.summary) return { oldValue: "", newValue: "" };
    const match = proposalData.summary.match(/from (\d+) to (\d+)/);
    return match
      ? { oldValue: match[1], newValue: match[2] }
      : { oldValue: "", newValue: "" };
  };

  const pluralize = (count, singular) => {
    if (count == "1" || count == "0") {
      return `${count} ${singular}`;
    } else {
      return `${count} ${singular + "s"}`;
    }
  };

  const RoleChangeCard = ({ member, type, oldRoles, newRoles }) => {
    return (
      <div className="profile-header">
        <div className="content px-3 rounded-top-3">
          <Profile accountId={member} />
        </div>
        <div className="card p-3 border-top-0 pt-1 rounded-top-0 text-color">
          {type === "edit" ? (
            <>
              <label>Old Roles:</label>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {(oldRoles || []).join(", ")}
              </div>
              <label className="border-top mt-2 pt-2">New Roles:</label>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {(newRoles || []).join(", ")}
              </div>
            </>
          ) : (
            <>
              <label>{type === "add" ? "Assigned" : "Revoked"} Roles</label>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {(type === "add" ? newRoles : oldRoles).join(", ")}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const SettingsContent = () => {
    if (!proposalData) return null;

    const renderContent = () => {
      switch (proposalData.requestType) {
        case RequestType.MEMBERS: {
          const parsed = parseMembersSummary(proposalData.summary);
          return (
            <div className="d-flex flex-column gap-3">
              {parsed.map((change, index) => (
                <RoleChangeCard key={index} {...change} />
              ))}
            </div>
          );
        }
        case RequestType.VOTING_DURATION: {
          const { oldValue, newValue } = getOldAndNewValues();
          return (
            <ul className="summary-list mb-0 ps-3">
              <li>
                <div className="summary-item">
                  Old Duration: {pluralize(oldValue, "day")}
                </div>
              </li>
              <li>
                <div className="summary-item mt-1">
                  New Duration: {pluralize(newValue, "day")}
                </div>
              </li>
            </ul>
          );
        }
        case RequestType.VOTING_THRESHOLD: {
          const { oldValue, newValue } = getOldAndNewValues();
          return (
            <ul className="summary-list mb-0 ps-3">
              <li>
                <div className="summary-item">
                  Old Threshold: {pluralize(oldValue, "vote")}
                </div>
              </li>
              <li>
                <div className="summary-item mt-1">
                  New Threshold: {pluralize(newValue, "vote")}
                </div>
              </li>
            </ul>
          );
        }
        case RequestType.THEME: {
          const decodedArgs = decodeBase64(
            proposalData?.kind?.ChangeConfig?.config?.metadata
          );
          const logo = decodedArgs?.flagLogo;
          const primaryColor = decodedArgs?.primaryColor;

          return (
            <ul className="summary-list mb-0 ps-3">
              {logo && (
                <li>
                  <div className="summary-item">
                    Logo:
                    <img src={logo} alt="Logo" className="appearance-logo" />
                  </div>
                </li>
              )}
              {primaryColor && (
                <li>
                  <div className="summary-item my-1">
                    Primary Color:
                    <span
                      className="appearance-color-box"
                      style={{ backgroundColor: primaryColor }}
                      title={primaryColor}
                    />
                    {primaryColor}
                  </div>
                </li>
              )}
            </ul>
          );
        }
        case RequestType.OTHER:
        default:
          return null;
      }
    };

    const content = renderContent();
    return content ? (
      <div className="d-flex flex-column gap-2">
        <label className="border-top proposal-label">Summary</label>
        {content}
      </div>
    ) : null;
  };

  return (
    <div style={{ fontSize: "13px" }}>
      <ProposalDetails
        proposalData={proposalData}
        isDeleted={isDeleted}
        isCompactVersion={isCompactVersion}
        page="settings"
        proposalPeriod={proposalPeriod}
        approversGroup={settingsApproverGroup}
        proposalStatusLabel={{
          approved: `${proposalData?.requestType} Request Executed`,
          rejected: `${proposalData?.requestType} Request Rejected`,
          deleted: `${proposalData?.requestType} Request Deleted`,
          failed: `${proposalData?.requestType} Request Failed`,
          expired: `${proposalData?.requestType} Request Expired`,
        }}
        onClose={onClose}
        ProposalContent={
          <div className="card card-body d-flex flex-column gap-2">
            {proposalData?.title && (
              <h6 className="flex-1">{proposalData.title}</h6>
            )}
            {proposalData && <SettingsContent />}
            <label
              className={
                "proposal-label " +
                (proposalData?.requestType === RequestType.MEMBERS ||
                (proposalData?.requestType === RequestType.OTHER &&
                  !proposalData?.title)
                  ? ""
                  : "border-top")
              }
            >
              Transaction Details
            </label>
            <div className="p-2 rounded small code-block markdown-scroll">
              <pre className="mb-0">
                <code>{JSON.stringify(proposalData?.kind, null, 2)}</code>
              </pre>
            </div>
          </div>
        }
        VoteActions={
          proposalData &&
          (hasVotingPermission || hasDeletePermission) &&
          proposalData.status === "InProgress" && (
            <VoteActions
              votes={proposalData?.votes}
              proposalId={proposalData?.id}
              hasDeletePermission={hasDeletePermission}
              hasVotingPermission={hasVotingPermission}
              proposalCreator={proposalData?.proposer}
              avoidCheckForBalance={true}
              requiredVotes={requiredVotes}
              context="settings"
              isProposalDetailsPage={true}
              proposal={proposalData?.proposal}
            />
          )
        }
      />
    </div>
  );
};

export default SettingsProposalDetailsPage;
