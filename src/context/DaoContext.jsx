"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useParams } from "next/navigation";

const DaoContext = createContext(null);

export const useDao = () => {
  const context = useContext(DaoContext);
  if (!context) {
    throw new Error("useDao must be used within a DaoProvider");
  }
  return context;
};

export const DaoProvider = ({ children }) => {
  const params = useParams();
  const [daoId, setDaoId] = useState(null);

  // Extract daoId from URL params
  useEffect(() => {
    if (params?.daoId) {
      setDaoId(params.daoId);
    }
  }, [params]);

  // Validate DAO ID format
  const isValidDaoId = (id) => {
    if (!id) return false;
    // Basic validation for NEAR account ID format
    return /^[a-z0-9._-]+\.near$/.test(id) || /^[a-f0-9]{64}$/.test(id);
  };

  const value = {
    daoId,
    setDaoId,
    isValidDaoId,
    isDaoSelected: !!daoId && isValidDaoId(daoId),
  };

  return <DaoContext.Provider value={value}>{children}</DaoContext.Provider>;
};
