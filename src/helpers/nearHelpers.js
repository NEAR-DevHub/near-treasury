/**
 * NEAR blockchain-specific helper functions
 */

import Big from "big.js";
import { sha256 } from "js-sha256";
import { getNearBalances } from "@/api/rpc";

/**
 * Format NEAR amount from yoctoNEAR to NEAR with 2 decimals
 */
export function formatNearAmount(amount) {
  return Big(amount ?? "0")
    .div(Big(10).pow(24))
    .toFixed(2);
}

/**
 * Convert raw token amount to readable format by dividing by 10^decimals
 * @param {string|number} amount - Raw token amount
 * @param {string|number} decimals - Token decimals (default: 18)
 * @returns {string} Readable amount as string with full precision
 */
export function convertBalanceToReadableFormat(amount, decimals = 18) {
  try {
    return Big(amount ?? "0")
      .div(Big(10).pow(Number(decimals) || 18))
      .toString();
  } catch {
    return "0";
  }
}

/**
 * Format token balance with appropriate precision
 * Shows more decimals for very small amounts to avoid scientific notation
 * Automatically trims unnecessary trailing zeros (e.g., "5" instead of "5.00")
 * @param {string|number} amount - The token amount to format
 * @param {Object} options - Formatting options
 * @param {number} options.minAmount - Threshold for using extended decimals (default: 0.01)
 * @param {number} options.maxDecimals - Maximum decimals to show (default: 8)
 * @returns {string} Formatted token amount without scientific notation
 */
export const formatTokenBalance = (amount, options = {}) => {
  const {
    minAmount = 0.01,
    maxDecimals = 8,
    alwaysMaxDecimals = false,
  } = options;

  try {
    const bigAmount = Big(amount || 0);

    if (bigAmount.eq(0)) {
      return "0";
    }

    // If alwaysMaxDecimals is true, always use maxDecimals
    // Otherwise, for amounts >= minAmount, use fewer decimals (2)
    // For very small amounts, show up to maxDecimals
    const decimals = alwaysMaxDecimals
      ? maxDecimals
      : bigAmount.gte(minAmount)
        ? 2
        : maxDecimals;
    const formatted = bigAmount.toFixed(decimals);

    // Remove trailing zeros
    let trimmed = formatted
      .replace(/(\.\d*[1-9])?0+$/, "$1")
      .replace(/\.$/, "");

    // Add thousand separators
    const parts = trimmed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  } catch {
    return "0";
  }
};

/**
 * Format token amount with dynamic precision based on USD value
 */
export const formatTokenAmount = (amount, tokenPrice, minUsdValue = 0.01) => {
  if (!amount || !tokenPrice || tokenPrice === 0) {
    return "0";
  }

  const numAmount = Big(amount);
  const numPrice = Big(tokenPrice);

  if (numAmount.eq(0)) {
    return "0";
  }

  const usdValue = numAmount.mul(numPrice);

  // Calculate decimals needed so the smallest unit is worth <= $0.01
  const targetPrecision = Big(0.01);
  const requiredDecimals = Math.max(
    0,
    Math.ceil(-Math.log10(targetPrecision.div(numPrice).toNumber()))
  );

  // Calculate minimum decimals needed to show the actual amount (not round to 0)
  const amountString = numAmount.toFixed();
  const firstNonZeroIndex = amountString.search(/[1-9]/);
  const minDecimalsForAmount = firstNonZeroIndex > 0 ? firstNonZeroIndex : 0;

  // For very small amounts, use more decimals but cap at 8
  const decimals = usdValue.lt(minUsdValue)
    ? Math.min(8, Math.max(requiredDecimals + 2, minDecimalsForAmount))
    : Math.min(requiredDecimals, 8);

  const formatted = numAmount.toFixed(decimals);

  // Remove trailing zeros and decimal point if no fractional part remains
  let trimmed = formatted;
  if (formatted.includes(".")) {
    trimmed = formatted.replace(/(\.\d*[1-9])?0+$/, "$1");
    trimmed = trimmed.replace(/\.$/, ""); // Remove decimal if alone
  }

  const parts = trimmed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return parts.join(".");
};

/**
 * Format token amount to USD value
 */
export const formatUsdValue = (amount, tokenPrice) => {
  if (!amount || !tokenPrice) {
    return "$0.00";
  }

  const usdValue = Big(amount).mul(Big(tokenPrice));

  if (usdValue.lt(0.01)) {
    return "< $0.01";
  }

  const formatted = usdValue.toFixed(2);
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `$${parts.join(".")}`;
};

/**
 * Lockup contract minimum balance for storage
 */
export const LOCKUP_MIN_BALANCE_FOR_STORAGE = Big(3.5)
  .mul(Big(10).pow(24))
  .toFixed();

/**
 * Convert account ID to lockup contract ID using SHA256 hash
 * Returns lockup account if it exists, null otherwise
 */
export const accountToLockup = async (accountId) => {
  if (!accountId) return null;

  const lockupAccount = `${sha256(Buffer.from(accountId))
    .toString("hex")
    .slice(0, 40)}.lockup.near`;

  // Check if lockup account exists by checking balances
  const account = await getNearBalances(lockupAccount);
  if (account) {
    return lockupAccount;
  }

  return null;
};

/**
 * Validate NEAR account format
 * Accepts: account.near, account.tg, account.aurora, or 64-char hex (implicit)
 */
export const isValidNearAccount = (accountId) => {
  if (!accountId || typeof accountId !== "string") return false;

  const isHex64 = (str) => /^[0-9a-fA-F]{64}$/.test(str);

  return (
    isHex64(accountId) ||
    accountId.endsWith(".near") ||
    accountId.endsWith(".aurora") ||
    accountId.endsWith(".tg")
  );
};

/**
 * Deserialize lockup contract state from byte array
 */
export const deserializeLockupContract = (byteArray) => {
  let offset = 0;

  function readU8() {
    return byteArray[offset++];
  }

  function readU32() {
    const bytes = [
      byteArray[offset++],
      byteArray[offset++],
      byteArray[offset++],
      byteArray[offset++],
    ];
    let result = Big(0);
    for (let i = 0; i < 4; i++) {
      result = result.plus(Big(bytes[i]).mul(Big(256).pow(i)));
    }
    return result;
  }

  function readU64() {
    const bytes = Array(8)
      .fill(0)
      .map(() => byteArray[offset++]);
    let result = Big(0);
    for (let i = 0; i < 8; i++) {
      result = result.plus(Big(bytes[i]).mul(Big(256).pow(i)));
    }
    return result;
  }

  function readU128() {
    const bytes = Array(16)
      .fill(0)
      .map(() => byteArray[offset++]);
    let result = Big(0);
    for (let i = 0; i < 16; i++) {
      result = result.plus(Big(bytes[i]).mul(Big(256).pow(i)));
    }
    return result;
  }

  function readString() {
    const length = readU32().toNumber();
    const strBytes = byteArray.slice(offset, offset + length);
    offset += length;
    return String.fromCharCode(...strBytes);
  }

  function readOption(reader) {
    const hasValue = readU8() === 1;
    return hasValue ? reader() : null;
  }

  function readVecU8() {
    const length = readU32().toNumber();
    const bytes = byteArray.slice(offset, offset + length);
    offset += length;
    return Array.from(bytes);
  }

  // Deserialize TransfersInformation enum
  function readTransfersInformation() {
    const variant = readU8();
    if (variant === 0) {
      return {
        type: "TransfersEnabled",
        transfers_timestamp: readU64(),
      };
    } else if (variant === 1) {
      return {
        type: "TransfersDisabled",
        transfer_poll_account_id: readString(),
      };
    }
    throw `Invalid TransfersInformation variant ${variant}`;
  }

  // Deserialize TransactionStatus enum
  function readTransactionStatus() {
    const variant = readU8();
    return variant === 0 ? "Idle" : "Busy";
  }

  // Deserialize VestingSchedule
  function readVestingSchedule() {
    return {
      start_timestamp: readU64(),
      cliff_timestamp: readU64(),
      end_timestamp: readU64(),
    };
  }

  // Deserialize VestingInformation enum
  function readVestingInformation() {
    const variant = readU8();
    switch (variant) {
      case 0:
        return { type: "None" };
      case 1:
        return {
          type: "VestingHash",
          hash: readVecU8(),
        };
      case 2:
        return {
          type: "VestingSchedule",
          schedule: readVestingSchedule(),
        };
      case 3:
        return {
          type: "Terminating",
          unvested_amount: readU128(),
          status: readU8(), // TerminationStatus as simple u8 for now
        };
      default:
        throw new Error("Invalid VestingInformation variant");
    }
  }

  const result = {
    owner_account_id: readString(),
    lockup_information: {
      lockup_amount: readU128(),
      termination_withdrawn_tokens: readU128(),
      lockup_duration: readU64(),
      release_duration: readOption(readU64),
      lockup_timestamp: readOption(readU64),
      transfers_information: readTransfersInformation(),
    },
    vesting_information: readVestingInformation(),
    staking_pool_whitelist_account_id: readString(),
    staking_information: readOption(() => ({
      staking_pool_account_id: readString(),
      status: readTransactionStatus(),
      deposit_amount: readU128(),
    })),
    foundation_account_id: readOption(readString),
  };

  return result;
};
