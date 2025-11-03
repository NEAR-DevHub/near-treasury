"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { normalize } from "@/helpers/formatters";
import OffCanvas from "@/components/ui/OffCanvas";
import SettingsDropdown from "@/components/dropdowns/SettingsDropdown";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import ExportTransactions from "@/components/proposals/ExportTransactions";
import Pagination from "@/components/ui/Pagination";
import Table from "./Table";
import ProposalDetailsPage from "./ProposalDetailsPage";
import CreateAssetExchangeRequest from "./CreateAssetExchangeRequest";

const AssetExchangeIndex = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPermission } = useDao();

  const tab = searchParams.get("tab");
  const id = searchParams.get("id");

  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showProposalDetailsId, setShowProposalId] = useState(null);

  const currentTab = useMemo(
    () => ({
      title: tab === "history" ? "History" : "Pending Requests",
    }),
    [tab]
  );

  const hasCreatePermission = hasPermission?.("call", "AddProposal");

  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const statuses = useMemo(
    () =>
      currentTab.title === "Pending Requests"
        ? ["InProgress"]
        : ["Approved", "Rejected", "Expired", "Failed"],
    [currentTab.title]
  );

  const {
    proposals,
    total: totalLength,
    isLoading,
  } = useProposals({
    category: "asset-exchange",
    statuses,
    page,
    pageSize: rowsPerPage,
    sortDirection,
  });

  const proposalDetailsPageId = useMemo(
    () => (id || id === "0" || id === 0 ? parseInt(id) : null),
    [id]
  );

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  const toggleCreatePage = useCallback(() => {
    setShowCreateRequest((prev) => !prev);
  }, []);

  const handleSortClick = useCallback(() => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const handleCloseProposalDetails = useCallback(() => {
    setShowProposalId(null);
  }, []);

  const handleOpenCreateRequest = useCallback(() => {
    setShowCreateRequest(true);
  }, []);

  const handleSelectRequest = useCallback((id) => {
    setShowProposalId(id);
  }, []);

  const ActionButtonComponent = useCallback(
    () => (
      <button className="btn primary-button d-flex align-items-center gap-2 mb-0">
        <i className="bi bi-plus-lg h5 mb-0"></i>
        <span className="responsive-text">Create Request</span>
      </button>
    ),
    []
  );

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
          <OffCanvas
            showCanvas={showCreateRequest}
            onClose={toggleCreatePage}
            title={"Create Asset Exchange Request"}
          >
            <CreateAssetExchangeRequest onCloseCanvas={toggleCreatePage} />
          </OffCanvas>

          <div className="layout-flex-wrap flex-grow-1 align-items-start">
            <div className="layout-main">
              <div className="card py-3 d-flex flex-column w-100 h-100 flex-grow-1">
                <div>
                  <div
                    className="d-flex justify-content-between border-bottom gap-2 align-items-center flex-wrap flex-md-nowrap"
                    style={{ paddingRight: "10px" }}
                  >
                    <ul className="custom-tabs nav gap-2 flex-shrink-0">
                      {[
                        { title: "Pending Requests" },
                        { title: "History" },
                      ].map(({ title }) => (
                        <li key={title}>
                          <div
                            onClick={() => {
                              const params = new URLSearchParams(searchParams);
                              params.set("tab", normalize(title));
                              router.push(`?${params.toString()}`);
                            }}
                            className={[
                              "d-inline-flex gap-2 nav-link",
                              normalize(currentTab.title) === normalize(title)
                                ? "active"
                                : "",
                            ].join(" ")}
                          >
                            <span>{title}</span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="d-flex gap-2 align-items-center flex-wrap flex-sm-nowrap pb-2 pb-md-0 ps-2 ps-md-0 flex-grow-1 justify-content-start justify-content-md-end">
                      {currentTab.title === "History" && (
                        <div style={{ minWidth: "fit-content" }}>
                          <ExportTransactions page="asset-exchange" />
                        </div>
                      )}
                      <SettingsDropdown
                        page="asset-exchange"
                        isPendingPage={currentTab.title === "Pending Requests"}
                      />

                      {hasCreatePermission && (
                        <div style={{ minWidth: "fit-content" }}>
                          <InsufficientBannerModal
                            ActionButton={ActionButtonComponent}
                            checkForDeposit={true}
                            callbackAction={handleOpenCreateRequest}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Table
                  proposals={proposals}
                  isPendingRequests={currentTab.title === "Pending Requests"}
                  loading={isLoading}
                  onSelectRequest={handleSelectRequest}
                  selectedProposalDetailsId={showProposalDetailsId}
                  handleSortClick={handleSortClick}
                  sortDirection={sortDirection}
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
                  onClose={handleCloseProposalDetails}
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

export default AssetExchangeIndex;
