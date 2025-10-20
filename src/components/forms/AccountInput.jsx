"use client";

import { useState, useEffect } from "react";
import { accountToLockup, isValidNearAccount } from "@/helpers/nearHelpers";
import { isHex64 } from "@/helpers/formatters";
import { Near } from "@/api/near";
import AccountAutocomplete from "@/components/forms/AccountAutocomplete";

/**
 * Optimized AccountInput Component
 * Input for NEAR account IDs with validation and autocomplete
 *
 * @param {string} value - Current account value
 * @param {string} placeholder - Input placeholder
 * @param {Function} onUpdate - Callback when value changes
 * @param {Function} setParentAccountValid - Callback to set parent validation state
 * @param {string} maxWidth - Max width of input
 * @param {boolean} allowNonExistentImplicit - Allow implicit accounts (64 char hex)
 * @param {boolean} checkLockup - Check if account has lockup contract
 * @param {boolean} disabled - Disable input
 */
const AccountInput = ({
  value,
  placeholder = "account.near",
  onUpdate,
  setParentAccountValid,
  maxWidth = "100%",
  allowNonExistentImplicit = false,
  checkLockup = false,
  disabled = false,
}) => {
  const [isValidAccount, setValidAccount] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] =
    useState(false);
  const [hasLockup, setHasLockup] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);

  // Check account availability
  const checkAccountAvailability = async (accountId) => {
    setIsCheckingAccount(true);

    try {
      // Skip check for implicit accounts if allowed
      if (
        allowNonExistentImplicit &&
        accountId.length === 64 &&
        isHex64(accountId)
      ) {
        setValidAccount(true);
        setHasLockup(false);
        setIsCheckingAccount(false);
        return;
      }

      // Check for lockup if required
      if (checkLockup) {
        const lockupData = await accountToLockup(accountId);
        if (lockupData) {
          setHasLockup(true);
          setValidAccount(false);
          setIsCheckingAccount(false);
          return;
        } else {
          setHasLockup(false);
        }
      }

      // Check if account exists on NEAR
      const accountData = await Near.viewAccount(accountId);

      if (!accountData) {
        setValidAccount(false);
      } else {
        setValidAccount(true);
      }
    } catch (error) {
      console.error("Error checking account:", error);
      setValidAccount(false);
    }

    setIsCheckingAccount(false);
  };

  // Validate and check account with debounce
  useEffect(() => {
    if (!value) {
      setValidAccount(false);
      setShowAutocomplete(false);
      return;
    }

    const handler = setTimeout(() => {
      const isValidFormat = isValidNearAccount(value);

      if (isValidFormat) {
        checkAccountAvailability(value);
      } else {
        setValidAccount(false);
      }

      // Show autocomplete for any input (valid or partial)
      if (value && value.length > 0) {
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [value, allowNonExistentImplicit, checkLockup]);

  // Update parent validation state
  useEffect(() => {
    if (setParentAccountValid) {
      setParentAccountValid(isValidAccount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidAccount]);

  return (
    <div className="d-flex flex-column">
      <div className="position-relative">
        <span className="position-absolute top-50 start-0 translate-middle-y ms-2 text-secondary me-2">
          @
        </span>
        <input
          type="text"
          style={{ paddingLeft: "2rem" }}
          className={`form-control ${
            value ? (isValidAccount ? "is-valid" : "is-invalid") : ""
          }`}
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => {
            onUpdate(e.target.value);
            setSelectedFromAutocomplete(false);
          }}
          disabled={disabled}
          maxLength={64}
        />
        {isCheckingAccount && (
          <div className="position-absolute top-50 end-0 translate-middle-y me-2">
            <div
              className="spinner-border spinner-border-sm"
              role="status"
            ></div>
          </div>
        )}
      </div>

      {/* Error messages */}
      {value && (
        <div className="text-sm mt-2">
          {hasLockup && (
            <span className="text-danger">
              This account already has an active lockup. You can only have one
              active lockup at a time.
            </span>
          )}
        </div>
      )}

      {/* Autocomplete */}
      {showAutocomplete && !selectedFromAutocomplete && value && (
        <AccountAutocomplete
          term={value}
          onSelect={(id) => {
            onUpdate(id);
            setShowAutocomplete(false);
            setSelectedFromAutocomplete(true);
          }}
          onClose={() => setShowAutocomplete(false)}
        />
      )}
    </div>
  );
};

export default AccountInput;
