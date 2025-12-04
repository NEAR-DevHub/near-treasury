"use client";

import { useState, useEffect, useCallback } from "react";
import { getPaymentListStatus } from "@/api/bulk-payment";

/**
 * Toast component that shows bulk payment processing progress
 * Polls the backend API until all payments are processed
 */
const BulkPaymentProcessingToast = ({
  listId,
  recipients = [], // Array of { recipient, amount } objects
  onComplete,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [paidCount, setPaidCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);

  const totalCount = recipients.length;

  // Poll the API for payment status
  const pollStatus = useCallback(async () => {
    if (!listId || isComplete) return;

    try {
      const result = await getPaymentListStatus(listId);

      if (result?.success && result?.list) {
        const { paid_payments, failed_payments, pending_payments } =
          result.list;

        setPaidCount(paid_payments || 0);
        setFailedCount(failed_payments || 0);

        // Check if all payments are processed (no pending)
        if (pending_payments === 0) {
          setIsComplete(true);
          onComplete?.();
        }
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error("Error polling payment status:", err);
      setError(err.message);
    }
  }, [listId, isComplete, onComplete]);

  // Start polling when component mounts
  useEffect(() => {
    if (!listId || !isVisible) return;

    // Initial poll
    pollStatus();

    // Poll every 3 seconds
    const interval = setInterval(pollStatus, 3000);

    return () => clearInterval(interval);
  }, [listId, isVisible, pollStatus]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  // Calculate which recipients are "paid" based on paidCount
  // We show them in order, so first N recipients are marked as paid
  const getRecipientStatus = (index) => {
    if (index < paidCount) return "paid";
    if (index < paidCount + failedCount) return "failed";
    return "pending";
  };

  const truncateAddress = (address) => {
    if (!address) return "";
    if (address.length <= 24) return address;
    return `${address.slice(0, 20)}...`;
  };

  return (
    <div
      className="toast-container position-fixed bottom-0 end-0 p-3"
      style={{ zIndex: 1055 }}
    >
      <div className="toast show" style={{ minWidth: 320 }}>
        <div className="toast-header px-3 py-2">
          <strong className="me-auto">Just now</strong>
          <i
            className="bi bi-x-lg h6 mb-0 cursor-pointer"
            onClick={handleClose}
          ></i>
        </div>
        <div className="toast-body px-3 py-3">
          <div className="fw-bold mb-3">Bulk Payment Processing</div>

          {error ? (
            <div className="text-danger small">
              <i className="bi bi-exclamation-circle me-2"></i>
              {error}
            </div>
          ) : (
            <div
              className="d-flex flex-column gap-2"
              style={{ maxHeight: 300, overflowY: "auto" }}
            >
              {recipients.map((payment, index) => {
                const status = getRecipientStatus(index);
                return (
                  <div
                    key={index}
                    className="d-flex align-items-center justify-content-between"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-secondary small">
                        {index + 1}/{totalCount}
                      </span>
                      <span
                        className="text-truncate"
                        style={{ maxWidth: 180 }}
                        title={payment.recipient}
                      >
                        @{truncateAddress(payment.recipient)}
                      </span>
                    </div>
                    <div>
                      {status === "paid" && (
                        <i
                          className="bi bi-check-circle-fill"
                          style={{ color: "#28a745", fontSize: "1.1rem" }}
                        ></i>
                      )}
                      {status === "failed" && (
                        <i
                          className="bi bi-x-circle-fill"
                          style={{ color: "#dc3545", fontSize: "1.1rem" }}
                        ></i>
                      )}
                      {status === "pending" && (
                        <div
                          className="spinner-border spinner-border-sm text-secondary"
                          role="status"
                          style={{ width: 16, height: 16 }}
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isComplete && !error && (
            <div className="mt-3 pt-2 border-top">
              <div className="d-flex align-items-center gap-2 text-success">
                <i className="bi bi-check-circle-fill"></i>
                <span>All payments completed!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentProcessingToast;
