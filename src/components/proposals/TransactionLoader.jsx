"use client";

/**
 * TransactionLoader Component
 * Shows a toast notification when transaction is in progress
 *
 * @param {boolean} showInProgress - Whether to show the loader
 * @param {Function} cancelTxn - Callback to cancel transaction
 */
const TransactionLoader = ({ showInProgress }) => {
  if (!showInProgress) return null;

  return (
    <div className="toast-container position-fixed bottom-0 end-0 p-3">
      <div className="toast show">
        <div className="toast-header px-2">
          <strong className="me-auto">Just Now</strong>
        </div>
        <div className="toast-body">
          <div className="d-flex gap-3">
            <img
              height={30}
              width={30}
              src="https://i.gifer.com/origin/34/34338d26023e5515f6cc8969aa027bca.gif"
              alt="Loading..."
            />
            <div className="d-flex flex-column gap-2">
              <div className="flex-1 text-left">
                Awaiting transaction confirmation...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionLoader;
