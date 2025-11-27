"use client";

import { createContext, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDao } from "@/context/DaoContext";
import ProposalToast from "@/components/proposals/ProposalToast";
import { REFRESH_DELAY } from "@/constants/ui";

const ProposalToastContext = createContext(null);

// Map context to category name for query invalidation
// Context values: "payment", "stake", "exchange", "function", "settings"
const contextToCategoryMap = {
  payment: "payments",
  stake: "stake-delegation",
  exchange: "asset-exchange",
  function: "function-call",
  settings: "settings",
  request: "payments", // default
};

export const ProposalToastProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const { daoId, refetchLastProposalId } = useDao();

  const [toastState, setToastState] = useState({
    show: false,
    status: null,
    proposalId: null,
    context: "request", // default context
  });

  const showToast = (status, proposalId = null, context = "request") => {
    const category = contextToCategoryMap[context] || "";

    if (!daoId) return;

    // Wait for indexer to process the transaction
    setTimeout(async () => {
      let actualProposalId = proposalId;

      // For newly added proposals, fetch and calculate the correct proposal ID
      // lastProposalId from contract is the count, actual ID is count - 1 (0-indexed)
      if (
        status &&
        (status === "ProposalAdded" ||
          status === "StakeProposalAdded" ||
          status === "UnstakeProposalAdded" ||
          status === "WithdrawProposalAdded") &&
        proposalId === null &&
        refetchLastProposalId
      ) {
        try {
          const newLastProposalId = await refetchLastProposalId();
          console.log("newLastProposalId", newLastProposalId);
          actualProposalId = newLastProposalId - 1; // Actual ID is count - 1
        } catch (e) {
          console.error("Error fetching proposal ID:", e);
        }
      }

      // Show toast with correct proposal ID
      setToastState({
        show: true,
        status,
        proposalId: actualProposalId,
        context,
      });

      // Invalidate cache to refresh the table and proposal details
      if (category === "function-call") {
        // Function-call uses null category + proposalType ["FunctionCall"]
        await queryClient.invalidateQueries({
          queryKey: ["proposals", daoId, undefined, ["FunctionCall"]],
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: ["proposals", daoId, category],
        });
      }

      // Also invalidate single proposal queries (for ProposalDetailsPage)
      if (actualProposalId !== null && actualProposalId !== undefined) {
        await queryClient.invalidateQueries({
          queryKey: ["proposal", daoId, actualProposalId],
        });
      }
    }, REFRESH_DELAY);
  };

  const hideToast = () => {
    setToastState((prev) => ({ ...prev, show: false }));
  };

  return (
    <ProposalToastContext.Provider
      value={{
        showToast,
        hideToast,
      }}
    >
      {children}
      <ProposalToast
        toastState={toastState}
        onClose={hideToast}
        context={toastState.context}
      />
    </ProposalToastContext.Provider>
  );
};

export const useProposalToastContext = () => {
  const context = useContext(ProposalToastContext);
  if (!context) {
    throw new Error(
      "useProposalToastContext must be used within ProposalToastProvider"
    );
  }
  return context;
};
