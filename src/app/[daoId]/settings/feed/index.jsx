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
        search_not: "voting thresholds",
      },
      "Voting Thresholds": {
        proposalTypes: ["ChangePolicy"],
        search_not: "members",
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
    let searchNotValue = null;

    if (
      filters?.proposal_type?.values &&
      filters.proposal_type.values.length > 0
    ) {
      const selectedTypes = filters.proposal_type.values;
      const include = filters.proposal_type.include !== false;

      if (include) {
        const mappedTypes = [];
        const searchNotValues = [];
        selectedTypes.forEach((type) => {
          if (proposalTypeMapping[type]) {
            mappedTypes.push(...proposalTypeMapping[type].proposalTypes);
            // Collect all search_not values
            if (proposalTypeMapping[type].search_not) {
              searchNotValues.push(proposalTypeMapping[type].search_not);
            }
          }
        });
        if (mappedTypes.length > 0) {
          finalProposalTypes = [...new Set(mappedTypes)];
        }
        // Only use search_not if there's exactly one unique value
        // If multiple different search_not values exist, don't use any
        const uniqueSearchNotValues = [...new Set(searchNotValues)];
        if (uniqueSearchNotValues.length === 1) {
          searchNotValue = uniqueSearchNotValues[0];
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

    return { proposalTypes: finalProposalTypes, searchNot: searchNotValue };
  };

  const { proposalTypes, searchNot } = mapProposalTypeFilters(activeFilters);

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
    searchNot,
  });

  // Reset page when tab or filters change
  useEffect(() => {
    setPage(0);
  }, [tab, activeFilters, search]);

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

  return (
    <div className="w-100 h-100 flex-grow-1 d-flex flex-column">
      {typeof proposalDetailsPageId === "number" ? (
        <ProposalDetailsPage id={proposalDetailsPageId} />
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
                  sortDirection={sortDirection}
                  handleSortClick={handleSortClick}
                  onSelectRequest={(id) => setShowProposalId(id)}
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
