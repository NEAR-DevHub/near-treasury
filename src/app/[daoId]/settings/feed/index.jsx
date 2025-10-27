"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useProposals } from "@/hooks/useProposals";
import { normalize } from "@/helpers/formatters";
import Table from "@/app/[daoId]/settings/feed/Table";
import ProposalDetailsPage from "@/app/[daoId]/settings/feed/ProposalDetailsPage";
import Filters from "@/app/[daoId]/settings/feed/Filters";
import Pagination from "@/components/ui/Pagination";
import SettingsDropdown from "@/components/dropdowns/SettingsDropdown";

const SettingsFeed = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = searchParams.get("tab");
  const id = searchParams.get("id");

  const [showProposalDetailsId, setShowProposalId] = useState(null);
  const [showToastStatus, setToastStatus] = useState(false);
  const [voteProposalId, setVoteProposalId] = useState(null);
  // The tab comes from the settings page URL as "pending-requests" or "history"
  const currentTab = {
    title: tab === "history" ? "History" : "Pending Requests",
  };
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortDirection, setSortDirection] = useState("desc");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const proposalDetailsPageId =
    id || id === "0" || id === 0 ? parseInt(id) : null;

  // Map proposal type filters
  const mapProposalTypeFilters = (filters) => {
    const proposalTypeMapping = {
      "Members Permissions": {
        proposalTypes: [
          "ChangePolicy",
          "AddMemberToRole",
          "RemoveMemberFromRole",
        ],
      },
      "Voting Thresholds": {
        proposalTypes: ["ChangePolicy"],
      },
      "Voting Duration": {
        proposalTypes: ["ChangePolicyUpdateParameters"],
      },
      "Theme & logo": {
        proposalTypes: ["ChangeConfig"],
      },
    };

    let finalProposalTypes = [
      "ChangeConfig",
      "ChangePolicy",
      "AddMemberToRole",
      "RemoveMemberFromRole",
      "ChangePolicyAddOrUpdateRole",
      "ChangePolicyRemoveRole",
      "ChangePolicyUpdateDefaultVotePolicy",
      "ChangePolicyUpdateParameters",
      "UpgradeSelf",
    ];

    if (
      filters?.proposal_type?.values &&
      filters.proposal_type.values.length > 0
    ) {
      const selectedTypes = filters.proposal_type.values;
      const include = filters.proposal_type.include !== false;

      if (include) {
        const mappedTypes = [];
        selectedTypes.forEach((type) => {
          if (proposalTypeMapping[type]) {
            mappedTypes.push(...proposalTypeMapping[type].proposalTypes);
          }
        });
        if (mappedTypes.length > 0) {
          finalProposalTypes = [...new Set(mappedTypes)];
        }
      } else {
        const excludedTypes = [];
        selectedTypes.forEach((type) => {
          if (proposalTypeMapping[type]) {
            excludedTypes.push(...proposalTypeMapping[type].proposalTypes);
          }
        });
        finalProposalTypes = finalProposalTypes.filter(
          (type) => !excludedTypes.includes(type)
        );
      }
    }

    return finalProposalTypes;
  };

  const proposalTypes = mapProposalTypeFilters(activeFilters);

  // Use the proposals hook
  const {
    proposals,
    total: totalLength,
    isLoading,
    invalidateCategory,
  } = useProposals({
    category: "settings",
    proposalType: proposalTypes,
    statuses:
      currentTab.title === "Pending Requests"
        ? ["InProgress"]
        : ["Approved", "Rejected", "Expired", "Failed"],
    page,
    pageSize: rowsPerPage,
    sortDirection,
    filters: activeFilters,
    search,
  });

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  // Clear filters when switching tabs
  const handleTabChange = (title) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", normalize(title));
    router.push(`?${params.toString()}`);
    setActiveFilters({});
    setSearch("");
    setShowFilters(false);
  };

  // Handle sort click
  const handleSortClick = () => {
    const newDirection = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(newDirection);
  };

  const ToastStatusContent = () => {
    let content = "";
    switch (showToastStatus) {
      case "InProgress":
        content =
          "Your vote is counted" +
          (typeof proposalDetailsPageId === "number"
            ? "."
            : ", the request is highlighted.");
        break;
      case "Approved":
        content = "The request has been successfully executed.";
        break;
      case "Rejected":
        content = "The request has been rejected.";
        break;
      case "Removed":
        content = "The request has been successfully deleted.";
        break;
      default:
        content = `The request has ${showToastStatus}.`;
        break;
    }
    return (
      <div className="toast-body">
        <div className="d-flex align-items-center gap-3">
          {showToastStatus === "Approved" && (
            <i className="bi bi-check2 h3 mb-0 success-icon"></i>
          )}
          <div>
            {content}
            <br />
            {showToastStatus !== "InProgress" &&
              showToastStatus !== "Removed" &&
              typeof proposalDetailsPageId !== "number" && (
                <a
                  className="text-underline"
                  href={`?tab=${
                    tab === "history" ? "history" : "pending"
                  }&id=${voteProposalId}`}
                >
                  View in History
                </a>
              )}
          </div>
        </div>
      </div>
    );
  };

  const VoteSuccessToast = () => {
    return showToastStatus ? (
      <div className="toast-container position-fixed bottom-0 end-0 p-3">
        <div className={`toast ${showToastStatus ? "show" : ""}`}>
          <div className="toast-header px-2">
            <strong className="me-auto">Just Now</strong>
            <i
              className="bi bi-x-lg h6 mb-0 cursor-pointer"
              onClick={() => setToastStatus(null)}
            ></i>
          </div>
          <ToastStatusContent />
        </div>
      </div>
    ) : null;
  };

  return (
    <div className="w-100 h-100 flex-grow-1 d-flex flex-column">
      <VoteSuccessToast />
      {typeof proposalDetailsPageId === "number" ? (
        <ProposalDetailsPage
          id={proposalDetailsPageId}
          setToastStatus={setToastStatus}
          setVoteProposalId={setVoteProposalId}
        />
      ) : (
        <div className="h-100 w-100 flex-grow-1 d-flex flex-column">
          <div className="layout-flex-wrap flex-grow-1">
            <div className="layout-main">
              <div className="card py-3 d-flex flex-column w-100 h-100 flex-grow-1">
                {/* Sidebar Menu */}
                <div>
                  {/* Tabs */}
                  <div
                    className="d-flex justify-content-between border-bottom gap-2 align-items-center flex-wrap flex-md-nowrap"
                    style={{ paddingRight: "10px" }}
                  >
                    <ul className="custom-tabs nav gap-2 flex-shrink-0">
                      {[
                        { title: "Pending Requests" },
                        { title: "History" },
                      ].map(
                        ({ title }) =>
                          title && (
                            <li key={title}>
                              <div
                                onClick={() => handleTabChange(title)}
                                className={[
                                  "d-inline-flex gap-2 nav-link",
                                  normalize(currentTab.title) ===
                                  normalize(title)
                                    ? "active"
                                    : "",
                                ].join(" ")}
                              >
                                <span>{title}</span>
                              </div>
                            </li>
                          )
                      )}
                    </ul>

                    <div className="d-flex gap-2 align-items-center flex-wrap flex-sm-nowrap pb-2 pb-md-0 ps-2 ps-md-0 flex-grow-1 justify-content-start justify-content-md-end">
                      {/* Search and Filters */}
                      <div className="input-responsive">
                        <div className="input-group flex-grow-1">
                          <span className="input-group-text bg-transparent">
                            <i className="bi bi-search text-secondary"></i>
                          </span>
                          <input
                            type="text"
                            className={`form-control border-start-0 ${
                              search ? "border-end-0" : ""
                            }`}
                            placeholder={
                              isSearchFocused
                                ? "Search by id, title or summary"
                                : "Search"
                            }
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                          />
                          {search && (
                            <span className="input-group-text bg-transparent border-start-0">
                              <i
                                className="bi bi-x-lg cursor-pointer text-secondary"
                                onClick={() => setSearch("")}
                              ></i>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`btn btn-outline-secondary ${
                          showFilters ||
                          Object.keys(activeFilters ?? {}).length > 0
                            ? "active-filter"
                            : ""
                        }`}
                      >
                        <i className="bi bi-funnel"></i>
                      </button>
                      <SettingsDropdown page="settings" />
                    </div>
                  </div>

                  {showFilters && (
                    <div className="border-bottom">
                      <Filters
                        isPendingRequests={
                          currentTab.title === "Pending Requests"
                        }
                        activeFilters={activeFilters}
                        setActiveFilters={setActiveFilters}
                        setShowFilters={setShowFilters}
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <Table
                  proposals={proposals}
                  isPendingRequests={currentTab.title === "Pending Requests"}
                  loading={isLoading}
                  refreshTableData={() => invalidateCategory()}
                  sortDirection={sortDirection}
                  handleSortClick={handleSortClick}
                  onSelectRequest={(id) => setShowProposalId(id)}
                  highlightProposalId={showProposalDetailsId || voteProposalId}
                  setToastStatus={setToastStatus}
                  setVoteProposalId={setVoteProposalId}
                  selectedProposalDetailsId={showProposalDetailsId}
                />
                {(proposals ?? [])?.length > 0 && (
                  <div>
                    <Pagination
                      totalLength={totalLength}
                      totalPages={Math.ceil(totalLength / rowsPerPage)}
                      onNextClick={() => {
                        setPage(page + 1);
                      }}
                      onPrevClick={() => {
                        setPage(page - 1);
                      }}
                      currentPage={page}
                      rowsPerPage={rowsPerPage}
                      onRowsChange={(v) => {
                        setPage(0);
                        setRowsPerPage(parseInt(v));
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div
              className={`layout-secondary ${
                typeof showProposalDetailsId === "number" ? "show" : ""
              }`}
            >
              {typeof showProposalDetailsId === "number" && (
                <ProposalDetailsPage
                  id={showProposalDetailsId}
                  isCompactVersion={true}
                  onClose={() => setShowProposalId(null)}
                  setToastStatus={setToastStatus}
                  setVoteProposalId={setVoteProposalId}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsFeed;
