"use client";

import { useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { generateFilteredProposalsQuery } from "@/api/indexer";

const SPUTNIK_INDEXER_BASE = "https://sputnik-indexer.fly.dev";

const ExportTransactions = ({ page, activeFilters, amountValues, search }) => {
  const { accountId } = useNearWallet();
  const { daoId: treasuryDaoID } = useDao();
  const [csvUrl, setCsvUrl] = useState("");

  const generateCsvUrl = () => {
    let endpoint = `${SPUTNIK_INDEXER_BASE}/csv/proposals/${treasuryDaoID}`;
    switch (page) {
      case "payments": {
        endpoint += `?category=payments`;
        break;
      }
      case "stake-delegation": {
        endpoint += `?category=stake-delegation`;
        break;
      }
      case "asset-exchange": {
        endpoint += `?category=asset-exchange`;
        break;
      }
      case "lockup": {
        endpoint += `?category=lockup`;
        break;
      }
      case "function-call": {
        endpoint += `?proposal_types=FunctionCall`;
        break;
      }
      default: {
        break;
      }
    }
    setCsvUrl(endpoint);
  };

  useEffect(() => {
    generateCsvUrl();
  }, [page, treasuryDaoID]);

  const options = [
    {
      label: "All Requests",
      value: "all",
    },
    { label: "Filtered Requests Only", value: "filtered" },
  ];

  if (Object.keys(activeFilters || {}).length > 0 || search) {
    return (
      <div className="dropdown">
        <button
          type="button"
          data-bs-toggle="dropdown"
          aria-haspopup="true"
          aria-expanded="false"
          className="btn btn-outline-secondary d-flex gap-1 align-items-center"
        >
          <i className="bi bi-download h6 mb-0"></i>
          <span className="responsive-text">Export as CSV</span>
        </button>
        <ul className="dropdown-menu">
          {options.map(({ label, value }) => (
            <li key={value}>
              <a
                data-testid={`export-${value}`}
                href={
                  value === "all"
                    ? csvUrl
                    : `${csvUrl}&${generateFilteredProposalsQuery(
                        activeFilters,
                        accountId,
                        amountValues,
                        search
                      )}`
                }
                download="proposals.csv"
                target="_blank"
                rel="noopener noreferrer"
                className="dropdown-item cursor-pointer"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      {csvUrl && (
        <a
          href={csvUrl}
          download="proposals.csv"
          target="_blank"
          rel="noopener noreferrer"
        >
          <button className="btn btn-outline-secondary d-flex gap-1 align-items-center">
            <i className="bi bi-download h6 mb-0"></i>
            <span className="responsive-text">Export as CSV</span>
          </button>
        </a>
      )}
    </div>
  );
};

export default ExportTransactions;
