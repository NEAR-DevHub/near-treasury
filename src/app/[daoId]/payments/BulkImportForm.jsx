"use client";

import { useState } from "react";
import Big from "big.js";
import { useDao } from "@/context/DaoContext";
import { searchFTToken } from "@/api/backend";
import { Near } from "@/api/near";
import { isValidNearAccount } from "@/helpers/nearHelpers";
import Modal from "@/components/ui/Modal";

const NEAR_CONTRACT = "near";

/**
 * BulkImportForm Component
 * Allows importing multiple payment requests via CSV/TSV data
 */
const BulkImportForm = ({ onCloseCanvas = () => {}, showPreviewTable }) => {
  const { daoId: treasuryDaoID, daoNearBalances, daoFtBalances } = useDao();

  const [csvData, setCsvData] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [dataWarnings, setDataWarnings] = useState(null);
  const [dataErrors, setDataErrors] = useState(null);
  const [validatedData, setValidatedData] = useState(null);

  // CSV Parsing Utilities (kept local to this component)

  /**
   * Parse CSV/TSV data with auto-delimiter detection
   */
  function parseCsv(raw) {
    const delimiters = [",", "\t", ";"];
    const lines = raw.trim().split(/\r?\n/);
    let bestDelimiter = ",";
    let maxColumns = 0;

    // Detect the best delimiter based on max column count in the header
    for (const delimiter of delimiters) {
      const cols = splitCsvLine(lines[0], delimiter).length;
      if (cols > maxColumns) {
        maxColumns = cols;
        bestDelimiter = delimiter;
      }
    }

    return lines.map((line) => splitCsvLine(line, bestDelimiter));
  }

  /**
   * Split CSV line handling quotes and delimiters
   */
  function splitCsvLine(line, delimiter) {
    const result = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          field += '"'; // Escaped quote
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        result.push(field);
        field = "";
      } else {
        field += char;
      }
    }

    result.push(field);
    return result.map((f) => f.trim());
  }

  /**
   * Check if NEAR account exists on blockchain
   */
  async function isNearAccountExists(accountId) {
    try {
      const accountData = await Near.viewAccount(accountId);
      return !!accountData;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all treasury token balances from DaoContext
   */
  function getAllTreasuryBalances() {
    const balances = {};

    // Add NEAR balance
    balances[NEAR_CONTRACT] = daoNearBalances?.available || "0";

    // Add FT balances
    if (daoFtBalances?.fts) {
      daoFtBalances.fts.forEach((t) => {
        balances[t.contract] = t.amount || "0";
      });
    }

    return balances;
  }

  /**
   * Validate CSV input data
   */
  async function validateCsvInput() {
    const errors = [];
    const warnings = [];
    const tokensSum = [];
    const validData = [];

    const rows = parseCsv(csvData || "");

    if (rows.length === 0) {
      setDataErrors([{ row: 0, message: "No data provided" }]);
      setIsValidating(false);
      return;
    }

    const headers = rows[0];

    const colIdx = (name) =>
      headers.findIndex((h) =>
        (h || "").trim().toLowerCase().startsWith(name.toLowerCase())
      );

    const titleIdx = colIdx("Title");
    const summaryIdx = colIdx("Summary");
    const recipientIdx = colIdx("Recipient");
    const requestedTokenIdx = colIdx("Requested Token");
    const fundingAskIdx = colIdx("Funding Ask");
    const notesIdx = colIdx("Notes");

    if (rows.length - 1 > 10) {
      warnings.push({
        message:
          "You have added more than 10 requests. You can continue, but only the first 10 will be added to list.",
      });
    }

    if (
      titleIdx === -1 ||
      recipientIdx === -1 ||
      requestedTokenIdx === -1 ||
      fundingAskIdx === -1
    ) {
      errors.push({
        row: 0,
        message:
          "Missing one or more required columns: Title, Recipient, Requested Token, Funding Ask",
      });
      setDataErrors(errors);
      setIsValidating(false);
      return;
    }

    const rowPromises = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i;

      const processRow = () => {
        const rowErrors = [];
        const data = {};

        const title = (row[titleIdx] || "")?.trim();
        if (!title) {
          rowErrors.push("Title is missing.");
        } else {
          data["Title"] = title;
        }

        const summary = (row[summaryIdx] || "")?.trim() || "";
        data["Summary"] = summary;

        const recipient = (row[recipientIdx] || "")?.trim();
        let recipientCheckPromise;

        if (!recipient) {
          rowErrors.push("Recipient is missing.");
          recipientCheckPromise = Promise.resolve(null);
        } else {
          if (!isValidNearAccount(recipient)) {
            rowErrors.push("Invalid recipient address.");
            recipientCheckPromise = Promise.resolve(null);
          } else {
            recipientCheckPromise = isNearAccountExists(recipient).then(
              (exists) => {
                if (!exists) {
                  rowErrors.push("Recipient account does not exist.");
                  return null;
                } else {
                  data["Recipient"] = recipient;
                  return true;
                }
              }
            );
          }
        }

        return recipientCheckPromise.then((recipientValid) => {
          const token = (row[requestedTokenIdx] || "")?.trim();

          if (!token) {
            rowErrors.push("Requested Token is missing.");
            return { rowErrors, data };
          }

          return searchFTToken(token).then((tokenMeta) => {
            if (!tokenMeta) {
              rowErrors.push("Invalid token address.");
            }

            const amountStr = (row[fundingAskIdx] || "")?.trim();
            if (!amountStr) {
              rowErrors.push("Funding Ask is missing.");
            } else {
              const value = parseFloat(amountStr.replace(/,/g, ""));
              if (isNaN(value) || value < 0) {
                rowErrors.push("Funding Ask should be a non-negative number.");
              } else if (tokenMeta) {
                const adjustedAmount = Big(value)
                  .times(Big(10).pow(tokenMeta.decimals))
                  .toFixed();

                data["Requested Token"] = tokenMeta.contract;
                data["Funding Ask"] = adjustedAmount.toString();

                const existing = tokensSum.find(
                  (t) => t.contract === tokenMeta.contract
                );
                if (existing) {
                  existing.ask = Big(existing.ask)
                    .plus(adjustedAmount)
                    .toFixed();
                } else {
                  tokensSum.push({
                    contract: tokenMeta.contract,
                    symbol: tokenMeta.symbol || "",
                    ask: adjustedAmount,
                    balance: 0,
                  });
                }
              }
            }

            const notes = (row[notesIdx] || "")?.trim() || "";
            data["Notes"] = notes;

            return { rowErrors, data };
          });
        });
      };

      rowPromises.push(
        processRow().then(({ rowErrors, data }) => {
          if (rowErrors && rowErrors.length) {
            for (const msg of rowErrors) {
              errors.push({ row: rowNum, message: msg });
            }
          } else if (data) {
            validData.push(data);
          }
        })
      );
    }

    return Promise.all(rowPromises)
      .then(() => {
        // Check treasury balances if no errors
        if (errors.length === 0 && tokensSum.length > 0) {
          const balancesMap = getAllTreasuryBalances();

          const results = tokensSum.map(({ contract, ask, symbol }) => {
            const balance = balancesMap[contract] || "0";
            return { contract, symbol, ask, balance };
          });

          const insufficient = results.filter(({ ask, balance }) =>
            Big(balance).lt(ask)
          );

          if (insufficient.length > 0) {
            const tokens = insufficient.map(({ symbol }) => symbol).join(", ");
            warnings.push({
              message: `Treasury balance for ${tokens} is too low for the payments in this batch. Requests can be created but may not be approved until balances are refilled.`,
            });
          }
        }

        // Set final state
        if (!errors.length) {
          setValidatedData(validData.slice(0, 10));
        }
        setDataErrors(errors);
        setDataWarnings(warnings);
        setIsValidating(false);
      })
      .catch((err) => {
        console.error("Validation failed:", err);
        setIsValidating(false);
      });
  }

  /**
   * Format CSV errors for display
   */
  function formatCsvErrors(dataErrors) {
    if (!dataErrors || dataErrors.length === 0) return null;

    const rowErrors = {};
    dataErrors.forEach(({ row, message }) => {
      if (!rowErrors[row]) rowErrors[row] = [];
      rowErrors[row].push(message);
    });

    const errorCount = Object.keys(rowErrors).length;
    const errorLines = Object.entries(rowErrors).map(([row, msgs]) => (
      <div key={row}>{`Row #${row} - ${msgs.join(" ")}`}</div>
    ));

    return (
      <div>
        <div>{`Please correct the following ${errorCount} issue${
          errorCount > 1 ? "s" : ""
        } in your file and paste the data again:`}</div>
        {errorLines}
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <Modal
        isOpen={showCancelModal}
        heading="Are you sure you want to cancel?"
        onClose={() => setShowCancelModal(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowCancelModal(false)}
            >
              No
            </button>
            <button
              type="button"
              className="btn theme-btn"
              onClick={() => {
                setShowCancelModal(false);
                onCloseCanvas();
              }}
            >
              Yes
            </button>
          </>
        }
      >
        <p>
          This action will clear all the information you have entered in the
          form and cannot be undone.
        </p>
      </Modal>

      <div className="d-flex flex-column gap-2">
        <h6 className="mb-0 fw-bold">Step 1</h6>
        <div>Get the template and fill out the required payment details</div>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://docs.google.com/spreadsheets/d/1VGpYu7Nzuuf1mgdeYiMgB2I6rX3VYtvbKP3RY2HuIj4/"
          className="btn btn-outline-secondary d-flex align-items-center gap-2"
          style={{ width: "fit-content" }}
        >
          <i className="bi bi-download h6 mb-0"></i> Get the Template
        </a>
      </div>

      <div className="d-flex flex-column gap-2">
        <h6 className="mb-0 fw-bold">Step 2</h6>
        <div>
          Copy all the filled data from file and paste it into the field below
        </div>
        <div className="text-sm">Paste Data Below</div>
        <textarea
          className="form-control"
          rows={10}
          value={csvData ?? ""}
          onChange={(e) => {
            setCsvData(e.target.value);
            setValidatedData(null);
            setDataWarnings(null);
            setDataErrors(null);
          }}
          placeholder="Paste your CSV/TSV data here..."
        />
      </div>

      {dataErrors?.length > 0 && (
        <div
          className="d-flex gap-3 px-3 py-2 rounded-3 align-items-start"
          style={{
            backgroundColor: "rgba(217, 92, 74, 0.1)",
            color: "var(--other-red)",
            fontWeight: 500,
            fontSize: "13px",
          }}
        >
          <i
            className="bi bi-exclamation-octagon h5 mb-0"
            style={{ color: "var(--other-red)" }}
          ></i>
          {formatCsvErrors(dataErrors)}
        </div>
      )}

      {dataWarnings?.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {dataWarnings.map((w, i) => (
            <div
              key={i}
              className="d-flex gap-3 px-3 py-2 rounded-3 align-items-start"
              style={{
                backgroundColor: "rgba(255, 158, 0, 0.1)",
                color: "var(--other-warning)",
                fontWeight: 500,
                fontSize: "13px",
              }}
            >
              <i
                className="bi bi-exclamation-triangle h5 mb-0"
                style={{ color: "var(--other-warning)" }}
              ></i>
              <div>{w.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="d-flex mt-2 gap-3 justify-content-end">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setShowCancelModal(true)}
          disabled={isValidating}
        >
          Cancel
        </button>

        {validatedData ? (
          <button
            type="button"
            className="btn theme-btn"
            onClick={() => {
              showPreviewTable(validatedData);
            }}
          >
            Show {validatedData.length} Preview
          </button>
        ) : (
          <button
            type="button"
            className="btn theme-btn"
            disabled={!csvData || isValidating || dataErrors?.length}
            onClick={() => {
              setIsValidating(true);
              validateCsvInput();
            }}
          >
            {isValidating ? "Validating..." : "Validate Data"}
          </button>
        )}
      </div>
    </div>
  );
};

export default BulkImportForm;
