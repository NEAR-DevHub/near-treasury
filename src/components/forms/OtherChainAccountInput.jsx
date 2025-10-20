"use client";

import { useMemo } from "react";

/**
 * Optimized OtherChainAccountInput Component
 * Validates recipient addresses for various blockchains
 *
 * @param {string} blockchain - Blockchain name (btc, eth, sol, etc.)
 * @param {string} value - Current address value
 * @param {Function} setValue - Callback to update value
 * @param {Function} setIsValid - Callback to update validation state
 */
const OtherChainAccountInput = ({
  blockchain,
  value,
  setValue,
  setIsValid,
}) => {
  // Ethereum-like chains
  const ethLike = ["eth", "arb", "gnosis", "bera", "base", "pol", "bsc"];

  // Get blockchain-specific configuration
  const config = useMemo(() => {
    let placeholder = "Enter recipient account/address";
    let regex = null;

    if (blockchain === "btc") {
      placeholder = "Enter BTC Address (e.g., bc1... or 1...)";
      regex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/i;
    } else if (blockchain === "zec") {
      placeholder = "Enter ZEC Address (t1..., t3..., zc...)";
      regex = /^(t1|t3)[a-zA-HJ-NP-Z0-9]{33}$|^zc[a-z0-9]{76}$/i;
    } else if (blockchain === "sol") {
      placeholder = "Enter Solana Address";
      regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    } else if (blockchain === "doge") {
      placeholder = "Enter Dogecoin Address (D... or A...)";
      regex = /^[DA][a-km-zA-HJ-NP-Z1-9]{33}$/;
    } else if (blockchain === "xrp") {
      placeholder = "Enter XRP Address (r...)";
      regex = /^r[1-9A-HJ-NP-Za-km-z]{33}$/;
    } else if (blockchain === "tron") {
      placeholder = "Enter Tron Address (T...)";
      regex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
    } else if (ethLike.includes(blockchain)) {
      placeholder = `Enter ${blockchain.toUpperCase()} Address (0x...)`;
      regex = /^0x[a-fA-F0-9]{40}$/;
    }

    return { placeholder, regex };
  }, [blockchain]);

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);

    // Validate based on regex
    if (config.regex) {
      const isValid = config.regex.test(val);
      setIsValid(isValid);
    } else {
      setIsValid(!!val);
    }
  };

  const isValid = config.regex ? config.regex.test(value) : !!value;

  return (
    <div className="d-flex flex-column gap-1">
      <input
        type="text"
        className={`form-control ${
          value ? (isValid ? "is-valid" : "is-invalid") : ""
        }`}
        placeholder={config.placeholder}
        value={value || ""}
        onChange={handleChange}
      />
    </div>
  );
};

export default OtherChainAccountInput;
