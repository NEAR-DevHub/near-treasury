"use client";

import { useState, useEffect } from "react";
import { Near } from "@/api/near";
import NearToken from "@/components/icons/NearToken";

// Cache for token metadata to prevent re-fetching
const tokenMetadataCache = {};

/**
 * TokenIcon Component
 * Displays token icon and symbol
 *
 * @param {string} address - Token contract address (empty string or "near" for NEAR)
 * @param {number} number - Optional number to display before symbol
 */
const TokenIcon = ({ address = "", number = null }) => {
  const [ftMetadata, setFtMetadata] = useState(null);

  const isNEAR = address === "" || address.toLowerCase() === "near";
  const isWrapNear = address === "wrap.near";

  useEffect(() => {
    if (isNEAR) {
      const cachedMetadata = {
        symbol: "NEAR",
        decimals: 24,
        icon: null,
      };
      setFtMetadata(cachedMetadata);
      tokenMetadataCache["near"] = cachedMetadata;
    } else if (isWrapNear) {
      const cachedMetadata = {
        symbol: "wNEAR",
        decimals: 24,
        icon: "https://img.rhea.finance/images/w-NEAR-no-border.png",
      };
      setFtMetadata(cachedMetadata);
      tokenMetadataCache["wrap.near"] = cachedMetadata;
    } else if (address) {
      // Check cache first
      if (tokenMetadataCache[address]) {
        setFtMetadata(tokenMetadataCache[address]);
        return;
      }

      // Fetch from API if not cached
      Near.view(address, "ft_metadata", {})
        .then((metadata) => {
          setFtMetadata(metadata);
          tokenMetadataCache[address] = metadata; // Cache the result
        })
        .catch((error) => {
          console.error("Error fetching token metadata:", error);
          setFtMetadata(null);
          tokenMetadataCache[address] = null; // Cache null to prevent retries
        });
    }
  }, [address, isNEAR, isWrapNear]);

  if (!ftMetadata) {
    return (
      <div className="d-flex gap-1 align-items-center mb-0 justify-content-center">
        <div
          className="spinner-border spinner-border-sm"
          role="status"
          style={{ width: "24px", height: "24px" }}
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex gap-1 align-items-center mb-0 justify-content-center">
      {isNEAR ? (
        <NearToken width={24} height={24} />
      ) : (
        <img
          width="24"
          height="24"
          src={ftMetadata.icon}
          alt={ftMetadata.symbol}
          className="rounded-circle"
        />
      )}
      {number && <span>{number}</span>}
      <span>{ftMetadata.symbol}</span>
    </div>
  );
};

export default TokenIcon;
