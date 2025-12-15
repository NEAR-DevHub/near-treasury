"use client";

import { useState } from "react";
import Profile from "../ui/Profile";

/**
 * Toast component that shows bulk payment processing progress
 * Polls the backend API until all payments are processed
 */
const BulkPaymentProcessingToast = ({
  recipients = [], // Array of { recipient, amount, status } objects
  paidCount = 0, // Number of paid payments (from parent)
  failedCount = 0, // Number of failed payments (from parent)
  pendingCount = 0, // Number of pending payments (from parent)
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const totalCount = recipients.length;
  // Only show as complete if we have no pending AND we've actually processed some payments
  const isComplete = pendingCount === 0 && paidCount > 0;

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  // Calculate recipient status based on actual payment status if available
  const getRecipientStatus = (payment, index) => {
    // If payment has status object from backend, use it
    if (payment.status) {
      if (payment.status === "Pending") return "pending";
      if (payment.status?.Paid) return "paid";
      if (payment.status === "Failed") return "failed";
    }
    // Fallback to index-based calculation
    if (index < paidCount) return "paid";
    if (index < paidCount + failedCount) return "failed";
    return "pending";
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
          <div className="border-bottom pb-3 fw-bold mb-3">
            {isComplete ? (
              <div
                className="d-flex align-items-center gap-2"
                style={{ color: "var(--other-green)" }}
              >
                <i className="bi bi-check-circle-fill"></i>
                <span>All payments completed!</span>
              </div>
            ) : (
              "Bulk Payment Processing"
            )}
          </div>

          <div
            className="d-flex flex-column gap-2"
            style={{ maxHeight: 300, overflowY: "auto" }}
          >
            {recipients.map((payment, index) => {
              const status = getRecipientStatus(payment, index);
              return (
                <div
                  key={index}
                  className="d-flex align-items-center justify-content-between"
                >
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-semibold">
                      {index + 1}/{totalCount}
                    </span>
                    <span
                      className="text-truncate"
                      style={{ maxWidth: 180 }}
                      title={payment.recipient}
                    >
                      <Profile accountId={payment.recipient} showKYC={false} />
                    </span>
                  </div>
                  <div>
                    {status === "paid" && (
                      <i
                        className="bi bi-check-circle-fill"
                        style={{
                          color: "var(--other-green)",
                          fontSize: "1.1rem",
                        }}
                      ></i>
                    )}
                    {status === "failed" && (
                      <i
                        className="bi bi-x-circle-fill"
                        style={{
                          color: "var(--other-red)",
                          fontSize: "1.1rem",
                        }}
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
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentProcessingToast;
