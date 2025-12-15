"use client";

import { useState, useEffect } from "react";
import { useDao } from "@/context/DaoContext";
import { viewStorageCredits } from "@/api/bulk-payment";
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

  // Title input
  const [title, setTitle] = useState("");

  // Storage credits
  const [storageCredits, setStorageCredits] = useState(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Check if form should be disabled (no credits available)
  const isFormDisabled = !isLoadingCredits && storageCredits === 0;

  // Step 3: Data input
  const [activeTab, setActiveTab] = useState("paste"); // "paste" or "upload"
  const [csvData, setCsvData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null); // {name, size}
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [dataWarnings, setDataWarnings] = useState(null);
  const [dataErrors, setDataErrors] = useState(null);

  // Fetch storage credits on mount
  useEffect(() => {
    async function fetchCredits() {
      setIsLoadingCredits(true);
      try {
        const credits = await viewStorageCredits(treasuryDaoID);
        setStorageCredits(credits);
      } catch (error) {
        console.error("Error fetching storage credits:", error);
        setStorageCredits(0);
      } finally {
        setIsLoadingCredits(false);
      }
    }

    if (treasuryDaoID) {
      fetchCredits();
    }
  }, [treasuryDaoID]);

  // Reset errors when wallet, token, or CSV data changes
  useEffect(() => {
    setDataErrors(null);
    setDataWarnings(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallet, selectedToken, csvData]);

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
   * Parse CSV input data - only validate structure, not values
   */
  function parseAndValidateStructure() {
    const errors = [];
    const parsedData = [];

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

    const firstRow = rows[0];

    // Check if first row is a header or data
    const hasHeader = firstRow.some((cell) => {
      const cellLower = (cell || "").trim().toLowerCase();
      return (
        cellLower.startsWith("recipient") || cellLower.startsWith("amount")
      );
    });

    let recipientIdx, amountIdx, startRow;

    if (hasHeader) {
      // Has headers - find column indices
      const colIdx = (name) =>
        firstRow.findIndex((h) =>
          (h || "").trim().toLowerCase().startsWith(name.toLowerCase())
        );

      recipientIdx = colIdx("Recipient");
      amountIdx = colIdx("Amount");

      // Check for required columns
      if (recipientIdx === -1 || amountIdx === -1) {
        errors.push({
          row: 0,
          message: "Missing one or more required columns: Recipient, Amount",
        });
        setDataErrors(errors);
        setIsValidating(false);
        return;
      }

      startRow = 1; // Start from second row (skip header)
    } else {
      // No headers - assume first column is Recipient, second is Amount
      recipientIdx = 0;
      amountIdx = 1;
      startRow = 0; // Start from first row (it's data)
    }

    // Parse all rows without validation
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];

      // Skip completely empty rows
      if (row.every((cell) => !cell || !cell.trim())) {
        continue;
      }

      const data = {
        Recipient: (row[recipientIdx] || "").trim(),
        Amount: (row[amountIdx] || "").trim(),
      };

      parsedData.push(data);
    }

    if (parsedData.length === 0) {
      setDataErrors([{ row: 0, message: "No valid data rows found" }]);
      setIsValidating(false);
      return;
    }

    // Clear errors and go directly to preview
    setDataErrors(null);
    setDataWarnings(null);
    setIsValidating(false);

    // Automatically go to preview table
    showPreviewTable(parsedData, selectedWallet, selectedToken, title);
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
          Pay multiple recipients with a single proposal. Upload a CSV file or
          paste your payment data below.
        </p>

        {/* Credits Info Bar */}
        {!isLoadingCredits && storageCredits === 0 ? (
          <div className="d-flex align-items-center gap-3 px-3 py-2 rounded-3 info-box">
            <i className="bi bi-info-circle h6 mb-0"></i>
            <div>
              <div className="fw-bold">
                You've used all available recipient slots.
              </div>
              <div>
                Need more?{" "}
                <a
                  href="https://docs.neartreasury.com/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-underline"
                >
                  Contact us
                </a>{" "}
                and we'll help you upgrade.
              </div>
            </div>
          </div>
        ) : !isLoadingCredits ? (
          <div>
            You can include up to <strong>{storageCredits}</strong> recipient
            {storageCredits !== 1 ? "s" : ""} in each bulk payment.{" "}
            <a
              href="https://docs.neartreasury.com/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-underline"
            >
              Contact Us
            </a>{" "}
            to increase this limit.
          </div>
        ) : null}
      </div>
      {/* Form Container - Apply disabled class when credits are 0 */}
      <div
        className={
          "d-flex flex-column gap-3" + (isFormDisabled ? " form-disabled" : "")
        }
      >
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
                    if (!isFormDisabled) {
                      setSelectedWallet(wallet);
                      setSelectedToken(null);
                    }
                  }}
                  hideLockup={true}
                  disabled={isFormDisabled}
                />

                <TokensDropdown
                  selectedWallet={selectedWallet?.value}
                  disabled={!selectedWallet || isFormDisabled}
                  selectedValue={selectedToken?.contract}
                  onChange={() => {}} // Not used, we use setTokenMetadata
                  setTokenMetadata={(tokenData) =>
                    !isFormDisabled && setSelectedToken(tokenData)
                  }
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

              {/* Title Input */}
              <div className="d-flex flex-column gap-2">
                <label htmlFor="bulk-title" className="form-label mb-0">
                  Title
                </label>
                <input
                  id="bulk-title"
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => !isFormDisabled && setTitle(e.target.value)}
                  placeholder="Short descriptive title (e.g., Team Payout, Marketing Budget)"
                  disabled={isFormDisabled}
                />
              </div>

              {/* Tabs */}
              <ul className="form-custom-tabs nav">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === "paste" ? "active" : ""}`}
                    onClick={() => !isFormDisabled && setActiveTab("paste")}
                    type="button"
                    disabled={isFormDisabled}
                  >
                    Paste Data
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === "upload" ? "active" : ""}`}
                    onClick={() => !isFormDisabled && setActiveTab("upload")}
                    type="button"
                    disabled={isFormDisabled}
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
                        if (!isFormDisabled) {
                          setCsvData(e.target.value);
                          setDataWarnings(null);
                          setDataErrors(null);
                        }
                      }}
                      placeholder="Copy all the filled data from file and past it here"
                      disabled={isFormDisabled}
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
                            if (!isFormDisabled) {
                              setUploadedFile(null);
                              setCsvData(null);
                              setDataWarnings(null);
                              setDataErrors(null);
                            }
                          }}
                          disabled={isFormDisabled}
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
                          disabled={isFormDisabled}
                          onChange={(e) => {
                            if (!isFormDisabled) {
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
                            }
                          }}
                        />
                        <label
                          htmlFor="file-upload"
                          className="d-flex flex-column align-items-center cursor-pointer"
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

          <button
            type="button"
            className="btn theme-btn"
            disabled={
              isFormDisabled ||
              !csvData ||
              !selectedWallet ||
              !selectedToken ||
              isValidating ||
              dataErrors?.length
            }
            onClick={() => {
              if (!isFormDisabled) {
                setIsValidating(true);
                parseAndValidateStructure();
              }
            }}
          >
            {isValidating ? (
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportForm;
