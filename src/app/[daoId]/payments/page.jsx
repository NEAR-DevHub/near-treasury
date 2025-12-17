"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { normalize } from "@/helpers/formatters";
import Table from "@/app/[daoId]/payments/Table";
import ProposalDetailsPage from "@/app/[daoId]/payments/ProposalDetailsPage";
import CreatePaymentRequest from "@/app/[daoId]/payments/CreatePaymentRequest";
import BulkImportForm from "@/app/[daoId]/payments/BulkImportForm";
import BulkImportPreviewTable from "@/app/[daoId]/payments/BulkImportPreviewTable";
import Filters from "@/app/[daoId]/payments/Filters";
import ExportTransactions from "@/components/proposals/ExportTransactions";
import OffCanvas from "@/components/ui/OffCanvas";
import Pagination from "@/components/ui/Pagination";
import SettingsDropdown from "@/components/dropdowns/SettingsDropdown";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";

const PaymentsIndex = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { daoId: treasuryDaoID, hasPermission } = useDao();

  const tab = searchParams.get("tab");
  const id = searchParams.get("id");

  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showProposalDetailsId, setShowProposalId] = useState(null);

  // Derive current tab from URL
  const currentTab = {
    title: tab === "history" ? "History" : "Pending Requests",
  };
  const [isBulkImport, setIsBulkImport] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortDirection, setSortDirection] = useState("desc");
  const [amountValues, setAmountValues] = useState({
    min: "",
    max: "",
    equal: "",
    value: "between",
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const hasCreatePermission = hasPermission?.("transfer", "AddProposal");

  // Use the proposals hook
  const {
    proposals,
    total: totalLength,
    isLoading,
    invalidateCategory,
  } = useProposals({
    category: "payments",
    statuses:
      currentTab.title === "Pending Requests"
        ? ["InProgress"]
        : ["Approved", "Rejected", "Expired", "Failed"],
    page,
    pageSize: rowsPerPage,
    sortDirection,
    filters: activeFilters,
    search,
    amountValues,
  });

  const proposalDetailsPageId =
    id || id === "0" || id === 0 ? parseInt(id) : null;

  // Reset page when tab or filters change
  useEffect(() => {
    setPage(0);
  }, [tab, activeFilters, search, amountValues]);

  function toggleCreatePage() {
    setIsBulkImport(false);
    setShowCreateRequest(!showCreateRequest);
  }

  const handleSortClick = () => {
    const newDirection = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(newDirection);
  };

  return (
    <div className="w-100 h-100 flex-grow-1 d-flex flex-column">
      {typeof proposalDetailsPageId === "number" ? (
        <div className="mt-4">
          <ProposalDetailsPage
            id={proposalDetailsPageId}
            currentTab={currentTab}
          />
        </div>
      ) : (
        <div className="h-100 w-100 flex-grow-1 d-flex flex-column">
          {bulkPreviewData && (
            <BulkImportPreviewTable
              proposals={bulkPreviewData}
              closePreviewTable={() => setBulkPreviewData(null)}
            />
          )}

          <OffCanvas
            showCanvas={showCreateRequest}
            onClose={toggleCreatePage}
            title={
              isBulkImport
                ? "Import Payment Requests"
                : "Create Payment Request"
            }
          >
            {isBulkImport ? (
              <div>
                <div className="mb-3" style={{ fontSize: "13px" }}>
                  Create multiple payment requests at once by pasting data
                  copied from our spreadsheet template. Review and submit your
                  bulk requests with ease. You can add up to 10 requests at a
                  time.
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-text-color cursor-pointer"
                    href="https://docs.neartreasury.com/payments/bulk-import"
                  >
                    {" "}
                    View Step-by-Step Instructions
                  </a>
                </div>
                <BulkImportForm
                  onCloseCanvas={toggleCreatePage}
                  showPreviewTable={(data) => {
                    setBulkPreviewData(data);
                    toggleCreatePage();
                    setIsBulkImport(false);
                  }}
                />
              </div>
            ) : (
              <CreatePaymentRequest
                onCloseCanvas={toggleCreatePage}
                setIsBulkImport={setIsBulkImport}
              />
            )}
          </OffCanvas>

          <div className="layout-flex-wrap flex-grow-1 align-items-start">
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
                                onClick={() => {
                                  // Update URL params
                                  const params = new URLSearchParams(
                                    searchParams
                                  );
                                  params.set("tab", normalize(title));
                                  router.push(`?${params.toString()}`);
                                  // Clear filters when switching tabs since available filters change
                                  setActiveFilters({});
                                  setAmountValues({
                                    min: "",
                                    max: "",
                                    equal: "",
                                    value: "between",
                                  });
                                  setSearch("");
                                  setShowFilters(false);
                                }}
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

                      {/* Export button for History tab */}
                      {currentTab.title === "History" && (
                        <div style={{ minWidth: "fit-content" }}>
                          <ExportTransactions
                            page="payments"
                            activeFilters={activeFilters}
                            amountValues={amountValues}
                            search={search}
                          />
                        </div>
                      )}

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

                      <SettingsDropdown
                        page="payments"
                        isPendingPage={currentTab.title === "Pending Requests"}
                      />

                      {hasCreatePermission && (
                        <div style={{ minWidth: "fit-content" }}>
                          <InsufficientBannerModal
                            ActionButton={() => (
                              <button className="btn primary-button d-flex align-items-center gap-2 mb-0">
                                <i className="bi bi-plus-lg h5 mb-0"></i>
                                <span className="responsive-text">
                                  Create Request
                                </span>
                              </button>
                            )}
                            checkForDeposit={true}
                            callbackAction={() => setShowCreateRequest(true)}
                          />
                        </div>
                      )}
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
                        amountValues={amountValues}
                        setAmountValues={setAmountValues}
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
                  <Pagination
                    totalLength={totalLength}
                    totalPages={Math.ceil(totalLength / rowsPerPage)}
                    onNextClick={() => setPage(page + 1)}
                    onPrevClick={() => setPage(page - 1)}
                    currentPage={page}
                    rowsPerPage={rowsPerPage}
                    onRowsChange={(v) => {
                      setPage(0);
                      setRowsPerPage(parseInt(v));
                    }}
                  />
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
                  currentTab={currentTab}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsIndex;
