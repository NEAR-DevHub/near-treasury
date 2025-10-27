"use client";

import { useRouter, useSearchParams } from "next/navigation";
import ApprovedStatus from "@/components/icons/ApprovedStatus";
import RejectedStatus from "@/components/icons/RejectedStatus";
import Warning from "@/components/icons/Warning";
import Skeleton from "@/components/ui/Skeleton";
import Votes from "@/components/proposals/Votes";
import Approvers from "@/components/proposals/Approvers";
import Copy from "@/components/ui/Copy";
import Profile from "@/components/ui/Profile";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import { formatSubmissionTimeStamp } from "@/helpers/daoHelpers";
import Markdown from "@/components/ui/Markdown";

const ProposalDetails = ({
  proposalData,
  isDeleted = false,
  isCompactVersion = false,
  approversGroup,
  proposalStatusLabel,
  proposalPeriod,
  page,
  currentTab,
  onClose,
  VoteActions,
  ProposalContent,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requiredVotes = approversGroup?.requiredVotes;

  const ProposalStatus = () => {
    const Status = ({ bgColor, icon, label, className }) => {
      return (
        <div
          className={`d-flex flex-column align-items-center px-3 py-4 rounded-4 ${
            className || ""
          }`}
          style={{ backgroundColor: bgColor }}
        >
          <div className="d-flex gap-3 align-items-center">
            {icon}
            <div className="mb-0 text-large">{label}</div>
          </div>
        </div>
      );
    };

    switch (proposalData?.status) {
      case "Approved":
        return (
          <Status
            className="success-icon"
            bgColor="rgba(60, 177, 121, 0.16)"
            icon={<ApprovedStatus width={32} height={32} hideStroke={true} />}
            label={proposalStatusLabel?.approved || "Approved"}
          />
        );
      case "Rejected":
        return (
          <Status
            className="error-icon"
            bgColor="rgba(217, 92, 74, 0.16)"
            icon={<RejectedStatus width={32} height={32} hideStroke={true} />}
            label={proposalStatusLabel?.rejected || "Rejected"}
          />
        );
      case "Removed":
        return (
          <Status
            className="error-icon"
            bgColor="rgba(217, 92, 74, 0.16)"
            icon={<RejectedStatus width={32} height={32} hideStroke={true} />}
            label={proposalStatusLabel?.deleted || "Deleted"}
          />
        );
      case "Failed":
        return (
          <Status
            className="warning-icon"
            bgColor="rgba(177, 113, 8, 0.16)"
            icon={<Warning width={32} height={32} />}
            label={proposalStatusLabel?.failed || "Failed"}
          />
        );
      case "Expired":
        return (
          <Status
            className="text-grey-02"
            bgColor="var(--grey-04)"
            icon={<i className="bi bi-clock h2 mb-0"></i>}
            label={proposalStatusLabel?.expired || "Expired"}
          />
        );
      default: {
        return <></>;
      }
    }
  };

  const VotesDetails = () => {
    return (
      <div
        className={`card card-body d-flex flex-column gap-3 justify-content-around ${
          isCompactVersion ? "rounded-top-3" : ""
        }`}
      >
        <ProposalStatus />
        <Votes
          votes={proposalData?.votes}
          requiredVotes={requiredVotes}
          isProposalDetailsPage={true}
          isInProgress={proposalData?.status === "InProgress"}
        />
        {VoteActions}
        {/* TODO: Fix the issue with the approvers list refetching every second */}
        {/* {Object.keys(proposalData?.votes ?? {}).length > 0 && (
          <Approvers
            votes={proposalData?.votes}
            approversGroup={approversGroup?.approverAccounts}
            showApproversList={true}
          />
        )} */}
      </div>
    );
  };

  const CopyComponent = () => {
    if (!proposalData) return null;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("id", proposalData.id);
    const clipboardText = currentUrl.toString();

    return (
      <Copy
        label={isCompactVersion ? "" : "Copy link"}
        clipboardText={clipboardText}
        showLogo={true}
        checkLogoClass={isCompactVersion ? "h4" : ""}
        copyLogoClass={isCompactVersion ? "h4" : ""}
        className={
          isCompactVersion
            ? ""
            : "btn btn-outline-secondary d-flex gap-1 align-items-center"
        }
      />
    );
  };

  const Navbar = () => {
    const handleBackClick = () => {
      const params = new URLSearchParams(searchParams);
      params.delete("id");
      router.push(`?${params.toString()}`);
    };

    return !isCompactVersion ? (
      <div className="d-flex justify-content-between gap-2 align-items-center">
        <button
          onClick={handleBackClick}
          className="btn btn-outline-secondary d-flex gap-1 align-items-center"
        >
          <i className="bi bi-arrow-left"></i> Back
        </button>
        <CopyComponent />
      </div>
    ) : null;
  };

  const MainSkeleton = () => {
    return (
      <div className="card card-body d-flex flex-column gap-3">
        <div className="w-100" style={{ height: 35 }}>
          <Skeleton className="w-100 h-100 rounded-3" />
        </div>
        <div className="w-100" style={{ height: 150 }}>
          <Skeleton className="w-100 h-100 rounded-3" />
        </div>
        <div className="w-100" style={{ height: 50 }}>
          <Skeleton className="w-100 h-100 rounded-3" />
        </div>
        <div className="w-100" style={{ height: 50 }}>
          <Skeleton className="w-100 h-100 rounded-3" />
        </div>
      </div>
    );
  };

  const SecondarySkeleton = () => {
    return (
      <div className="card card-body d-flex flex-column h-100">
        <div className="w-100" style={{ height: 50 }}>
          <Skeleton className="w-100 h-100 rounded-3" />
        </div>
      </div>
    );
  };

  if (isDeleted) {
    return (
      <div
        key={proposalData?.id}
        className="container-lg alert alert-danger d-flex flex-column gap-3"
        role="alert"
      >
        The requested proposal was not found. Please verify the proposal ID or
        check if it has been removed.
        <button
          onClick={() => router.push(`?page=${page}`)}
          className="btn btn-danger d-flex gap-1 align-items-center"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!proposalData) {
    return (
      <div className="container-lg d-flex flex-column gap-3">
        <Navbar />
        <div>
          {isCompactVersion ? (
            <div className="d-flex flex-column gap-10px w-100">
              <SecondarySkeleton />
              <MainSkeleton />
              <SecondarySkeleton />
            </div>
          ) : (
            <div className="d-flex gap-3 w-100 flex-wrap">
              <div className="flex-3">
                <MainSkeleton />
              </div>
              <div className="d-flex flex-column gap-10px flex-2 h-100">
                <SecondarySkeleton />
                <SecondarySkeleton />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div key={proposalData?.id} className="text-sm">
      <div
        className={`container-lg d-flex flex-column ${
          isCompactVersion ? "absolute" : "relative"
        }`}
        style={{
          gap: isCompactVersion ? "0rem" : "1rem",
        }}
      >
        <Navbar />
        {isCompactVersion && (
          <div className="sticky top-0 z-50 bg-gray-50">
            <div className="d-flex justify-content-between gap-2 px-3 py-3 rounded-top-4 border border-bottom-0 bg-gray-100 relative">
              <div className="cursor-pointer" onClick={() => onClose?.()}>
                <i className="bi bi-x-lg h5 mb-0"></i>
              </div>
              <h5 className="mb-0">#{proposalData.id}</h5>
              <div className="d-flex gap-3">
                <CopyComponent />
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (currentTab?.title === "History") {
                      params.set("tab", "history");
                    }
                    params.set("id", proposalData.id);
                    router.push(`?${params.toString()}`);
                  }}
                >
                  <i className="bi bi-arrows-angle-expand h5 mb-0"></i>
                </div>
              </div>
            </div>
          </div>
        )}
        {isCompactVersion && (
          <div className="mb-2">
            <VotesDetails />
          </div>
        )}
        <div
          className={`d-flex flex-wrap align-items-start ${
            isCompactVersion ? "gap-10px flex-column" : "gap-3"
          }`}
        >
          <div
            className="flex-3 d-flex flex-column gap-3"
            style={{
              minWidth: 200,
              height: "fit-content",
              width: "-webkit-fill-available",
            }}
          >
            {ProposalContent}
          </div>
          <div
            className="flex-2 d-flex flex-column gap-10px"
            style={{ minWidth: 200, width: "-webkit-fill-available" }}
          >
            {!isCompactVersion && <VotesDetails />}
            <div
              className="card card-body d-flex flex-column gap-2"
              style={{ fontSize: 14 }}
            >
              <label className="proposal-label">Created By</label>
              <Profile
                accountId={proposalData?.proposer}
                showKYC={false}
                displayImage={true}
                displayName={true}
                profileClass="text-secondary text-sm"
              />
              <label className="border-top proposal-label">Created Date</label>
              <DateTimeDisplay timestamp={proposalData?.submissionTime / 1e6} />

              <label className="border-top proposal-label">Expires At</label>
              {formatSubmissionTimeStamp(
                proposalData?.submissionTime,
                proposalPeriod,
                true
              )}
              <label className="border-top proposal-label">Note</label>
              {proposalData?.notes ? (
                <Markdown>{proposalData?.notes}</Markdown>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalDetails;
