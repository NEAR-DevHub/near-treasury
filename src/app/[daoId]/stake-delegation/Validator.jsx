"use client";

import { useState, useEffect, useRef } from "react";
import { getValidatorDetails } from "@/api/backend";

// Cache validator details to prevent refetching
const validatorCache = {};

const Validator = ({ validatorId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!validatorId) {
      setLoading(false);
      return;
    }

    // Check cache first
    if (validatorCache[validatorId]) {
      setData(validatorCache[validatorId]);
      setLoading(false);
      return;
    }

    // Prevent double fetching
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    getValidatorDetails(validatorId)
      .then((result) => {
        validatorCache[validatorId] = result;
        setData(result);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching validator details:", error);
        setLoading(false);
      });
  }, [validatorId]);

  if (!validatorId) {
    return <div>-</div>;
  }

  if (loading) {
    return <div>{validatorId}</div>;
  }

  const fee = data?.fees?.numerator
    ? (data.fees.numerator / (data.fees.denominator || 100)) * 100
    : 0;
  const isActive = data && !data.is_slashed;

  return (
    <div className="d-flex flex-column gap-1">
      <div>{validatorId}</div>
      <div className="d-flex gap-2 align-items-center" style={{ fontSize: 12 }}>
        <div className="text-secondary">{fee.toFixed(1)}% Fee</div>
        {isActive && <div style={{ color: "#34c759" }}>Active</div>}
      </div>
    </div>
  );
};

export default Validator;
