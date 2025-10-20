"use client";

import { useState, useEffect } from "react";
import { searchAccounts } from "@/api/social";
import { isValidNearAccount } from "@/helpers/nearHelpers";
import { useNearWallet } from "@/context/NearWalletContext";
import Profile from "@/components/ui/Profile";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Account Autocomplete Component
 * Shows account suggestions based on search term
 *
 * @param {string} term - Search term
 * @param {Function} onSelect - Callback when account is selected
 * @param {Function} onClose - Callback when autocomplete is closed
 * @param {Array<string>} filterAccounts - Accounts to exclude from results
 */
const AccountAutocomplete = ({
  term,
  onSelect,
  onClose,
  filterAccounts = [],
}) => {
  const { accountId: currentAccountId } = useNearWallet();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!term) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Set loading immediately when term changes
    setIsLoading(true);

    const fetchAccounts = async () => {
      try {
        const accounts = await searchAccounts(
          term,
          currentAccountId,
          filterAccounts,
          5
        );
        setResults(accounts);
      } catch (error) {
        console.error("Error fetching accounts:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, currentAccountId]);

  // Check if term is a valid account
  const isValidAccount = isValidNearAccount(term);

  return (
    <div
      className="position-relative mt-1 w-100"
      style={{
        color: "var(--text-color)",
      }}
    >
      <div
        className="d-flex align-items-center gap-2 overflow-auto"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollBehavior: "smooth",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          className="btn btn-link p-0 text-secondary"
          onClick={onClose}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            display: "block",
            color: "var(--icon-color)",
            transition: "all 200ms",
          }}
        >
          <i className="bi bi-x-circle-fill h5 mb-0"></i>
        </button>

        {/* Results */}
        {isLoading ? (
          // Loading skeleton - horizontal cards like the actual options
          <>
            <div
              className="d-flex align-items-center gap-2"
              style={{
                minWidth: "175px",
                maxWidth: "175px",
                flexShrink: 0,
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "6px",
              }}
            >
              <Skeleton
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                }}
              />
              <div className="d-flex flex-column gap-1 flex-grow-1">
                <Skeleton
                  style={{
                    height: "12px",
                    width: "80%",
                    borderRadius: "4px",
                  }}
                />
                <Skeleton
                  style={{
                    height: "10px",
                    width: "60%",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
            <div
              className="d-flex align-items-center gap-2"
              style={{
                minWidth: "175px",
                maxWidth: "175px",
                flexShrink: 0,
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "6px",
              }}
            >
              <Skeleton
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                }}
              />
              <div className="d-flex flex-column gap-1 flex-grow-1">
                <Skeleton
                  style={{
                    height: "12px",
                    width: "90%",
                    borderRadius: "4px",
                  }}
                />
                <Skeleton
                  style={{
                    height: "10px",
                    width: "70%",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          </>
        ) : isValidAccount ? (
          <div
            className="cursor-pointer"
            style={{
              minWidth: "175px",
              maxWidth: "175px",
              flexShrink: 0,
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "6px",
              transition: "all 200ms",
            }}
            onClick={() => onSelect(term)}
          >
            <Profile accountId={term} showKYC={false} />
          </div>
        ) : (
          results.map((result) => (
            <div
              key={result.accountId}
              className="cursor-pointer"
              style={{
                minWidth: "175px",
                maxWidth: "175px",
                flexShrink: 0,
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "6px",
                transition: "all 200ms",
              }}
              onClick={() => onSelect(result.accountId)}
            >
              <Profile accountId={result.accountId} showKYC={false} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AccountAutocomplete;
