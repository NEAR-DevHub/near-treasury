"use client";

import { useState } from "react";
import Big from "big.js";
import { useDao } from "@/context/DaoContext";
import { searchFTToken } from "@/api/backend";
import { Near } from "@/api/near";
import { isValidNearAccount } from "@/helpers/nearHelpers";
import Modal from "@/components/ui/Modal";
import WalletDropdown from "@/components/dropdowns/WalletDropdown";
import TokensDropdown from "@/components/dropdowns/TokensDropdown";

const NEAR_CONTRACT = "near";

/**
 * BulkImportForm Component
 * Allows importing multiple payment requests via CSV/TSV data
 */
const BulkImportForm = ({ onCloseCanvas = () => {}, showPreviewTable }) => {
  const { daoId: treasuryDaoID, daoNearBalances, daoFtBalances } = useDao();

  // Step 1: Source wallet and token
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null); // Holds full token object with metadata

  // Step 3: Data input
  const [activeTab, setActiveTab] = useState("paste"); // "paste" or "upload"
  const [csvData, setCsvData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null); // {name, size}
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
   * Validate CSV input data
   */
  async function validateCsvInput() {
    const errors = [];
    const warnings = [];
    let totalAmount = Big(0);
    const validData = [];

    const rows = parseCsv(csvData || "");

    if (rows.length === 0) {
      setDataErrors([{ row: 0, message: "No data provided" }]);
      setIsValidating(false);
      return;
    }

    // Use token metadata from selected token
    const tokenMeta = selectedToken;
    if (!tokenMeta) {
      setDataErrors([{ row: 0, message: "Invalid token selected" }]);
      setIsValidating(false);
      return;
    }

    const headers = rows[0];

    const colIdx = (name) =>
      headers.findIndex((h) =>
        (h || "").trim().toLowerCase().startsWith(name.toLowerCase())
      );

    const recipientIdx = colIdx("Recipient");
    const amountIdx = colIdx("Amount");

    // Check for required columns (only Recipient and Amount)
    if (recipientIdx === -1 || amountIdx === -1) {
      errors.push({
        row: 0,
        message: "Missing one or more required columns: Recipient, Amount",
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

        // Validate recipient
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

        return recipientCheckPromise.then(() => {
          // Validate amount
          const amountStr = (row[amountIdx] || "")?.trim();
          if (!amountStr) {
            rowErrors.push("Amount is missing.");
          } else {
            const value = parseFloat(amountStr.replace(/,/g, ""));
            if (isNaN(value) || value <= 0) {
              rowErrors.push("Amount should be a positive number.");
            } else {
              const adjustedAmount = Big(value)
                .times(Big(10).pow(tokenMeta.decimals))
                .toFixed();

              data["Requested Token"] = tokenMeta.contract;
              data["Amount"] = adjustedAmount.toString();

              // Add to total amount for balance check
              totalAmount = totalAmount.plus(adjustedAmount);
            }
          }

          return { rowErrors, data };
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
        // Check treasury balance for selected token if no errors
        if (errors.length === 0 && totalAmount.gt(0)) {
          // Use token balance from selected token
          const availableBalance = selectedToken?.tokenBalance || "0";

          if (Big(availableBalance).lt(totalAmount)) {
            warnings.push({
              message: `Treasury balance for ${tokenMeta.symbol} is too low for the payments in this batch. Current balance: ${
                availableBalance
              } ${tokenMeta.symbol}. Required: ${totalAmount
                .div(Big(10).pow(tokenMeta.decimals))
                .toFixed()} ${
                tokenMeta.symbol
              }. Requests can be created but may not be approved until balances are refilled.`,
            });
          }
        }

        // Set final state
        if (!errors.length) {
          setValidatedData(validData);
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
    <div className="d-flex flex-column gap-4 pb-4" style={{ fontSize: "14px" }}>
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

      {/* Header */}
      <div className="d-flex flex-column gap-2">
        <p className="mb-0 text-secondary">
          Create multiple payment requests at once by adding data.{" "}
          <a
            href="https://docs.neartreasury.com/payments/bulk-import"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-underline"
          >
            View Step-by-Steps Instructions.
          </a>
        </p>
      </div>

      {/* Step 1: Select Source Wallet & Token */}
      <div className="d-flex flex-column gap-3">
        <div className="d-flex gap-2 align-items-start">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center fw-550"
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "var(--grey-05)",
            }}
          >
            1
          </div>
          <div className="d-flex flex-column gap-2 flex-grow-1">
            <h6 className="mb-0 fw-550 my-1">Select Source Wallet & Token</h6>

            <div className="d-flex flex-column gap-3 pl-3">
              <WalletDropdown
                hideLabel={true}
                selectedValue={selectedWallet}
                onUpdate={(wallet) => {
                  setSelectedWallet(wallet);
                  setSelectedToken(null);
                }}
                hideLockup={true}
              />

              <TokensDropdown
                selectedWallet={selectedWallet?.value}
                disabled={!selectedWallet}
                selectedValue={selectedToken?.contract}
                onChange={() => {}} // Not used, we use setTokenMetadata
                setTokenMetadata={(tokenData) => setSelectedToken(tokenData)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Get the template */}
      <div className="d-flex flex-column gap-3">
        <div className="d-flex gap-2 align-items-start">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center fw-550"
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "var(--grey-05)",
            }}
          >
            2
          </div>
          <div className="d-flex flex-column gap-2 flex-grow-1">
            <h6 className="mb-0 fw-550 my-1">
              Get the template and fill out the required payment details.
            </h6>

            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.google.com/spreadsheets/d/14wVi5X3iQQi8qE2h135jwtY8rQi0aFAhDz3LHApZkuM"
              className="btn btn-outline-secondary d-flex gap-2 align-items-center justify-content-center"
              style={{ width: "100%" }}
            >
              <span className="w-100 text-start">Get the Template</span>
              <i className="bi bi-download h6 mb-0"></i>
            </a>
          </div>
        </div>
      </div>

      {/* Step 3: Provide payment data */}
      <div className="d-flex flex-column gap-3">
        <div className="d-flex gap-2 align-items-start">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center fw-550"
            style={{
              width: "32px",
              height: "32px",
              backgroundColor: "var(--grey-05)",
            }}
          >
            3
          </div>
          <div className="d-flex flex-column gap-2 flex-grow-1">
            <h6 className="mb-0 fw-550 my-1">Provide payment data</h6>

            {/* Tabs */}
            <ul className="form-custom-tabs nav">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "paste" ? "active" : ""}`}
                  onClick={() => setActiveTab("paste")}
                  type="button"
                >
                  Paste Data
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "upload" ? "active" : ""}`}
                  onClick={() => setActiveTab("upload")}
                  type="button"
                >
                  Upload File
                </button>
              </li>
            </ul>

            {/* Tab content */}
            <div className="tab-content">
              {activeTab === "paste" && (
                <div className="d-flex flex-column gap-2">
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
                    placeholder="Copy all the filled data from file and past it here"
                  />
                </div>
              )}

              {activeTab === "upload" && (
                <div className="d-flex flex-column gap-2">
                  {uploadedFile ? (
                    // Show uploaded file info
                    <div
                      className="border rounded-3 p-3 d-flex align-items-center justify-content-between"
                      style={{ backgroundColor: "var(--grey-05)" }}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <i className="bi bi-file-earmark-text text-secondary h4 mb-0"></i>
                        <div>
                          <div className="fw-550">{uploadedFile.name}</div>
                          <div className="text-secondary text-sm">
                            {(uploadedFile.size / 1024).toFixed(0)}KB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-secondary"
                        onClick={() => {
                          setUploadedFile(null);
                          setCsvData(null);
                          setValidatedData(null);
                          setDataWarnings(null);
                          setDataErrors(null);
                        }}
                      >
                        <i className="bi bi-x h4 mb-0"></i>
                      </button>
                    </div>
                  ) : (
                    // Show upload dropzone
                    <div
                      className="border rounded-3 p-4 text-center"
                      style={{
                        borderStyle: "dashed",
                        backgroundColor: "var(--grey-05)",
                      }}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        accept=".csv,.tsv,.txt"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            // Store file info
                            setUploadedFile({
                              name: file.name,
                              size: file.size,
                            });

                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setCsvData(event.target.result);
                              setValidatedData(null);
                              setDataWarnings(null);
                              setDataErrors(null);
                            };
                            reader.onerror = (error) => {
                              console.error("Error reading file:", error);
                              setUploadedFile(null);
                              setDataErrors([
                                { row: 0, message: "Failed to read file" },
                              ]);
                            };
                            reader.readAsText(file);
                          }
                          // Reset input so same file can be selected again
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor="file-upload"
                        className="d-flex flex-column align-items-center cursor-pointer"
                        style={{ cursor: "pointer" }}
                      >
                        <i className="bi bi-upload text-secondary h4"></i>
                        <div className="fw-550">
                          Click to upload or drag and drop a file
                        </div>
                        <div className="text-secondary text-sm">
                          max 1 file up to 1.5 MB, CSV file only
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Errors */}
      {dataErrors?.length > 0 && (
        <div className="error-box d-flex gap-3 px-3 py-2 rounded-3 align-items-start">
          <i className="bi bi-exclamation-octagon h5 mb-0"></i>
          {formatCsvErrors(dataErrors)}
        </div>
      )}

      {/* Warnings */}
      {dataWarnings?.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {dataWarnings.map((w, i) => (
            <div
              key={i}
              className="warning-box d-flex gap-3 px-3 py-2 rounded-3 align-items-start"
            >
              <i className="bi bi-exclamation-triangle h5 mb-0"></i>
              <div>{w.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Buttons */}
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
              showPreviewTable(validatedData, selectedWallet, selectedToken);
            }}
          >
            Show {validatedData.length} Request
            {validatedData.length !== 1 ? "s" : ""}
          </button>
        ) : (
          <button
            type="button"
            className="btn theme-btn"
            disabled={
              !csvData ||
              !selectedWallet ||
              !selectedToken ||
              isValidating ||
              dataErrors?.length
            }
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
