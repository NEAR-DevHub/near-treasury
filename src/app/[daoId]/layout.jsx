"use client";

import { Suspense } from "react";
import { useTransactionHandler } from "@/hooks/useTransactionHandler";
import { ProposalToastProvider } from "@/context/ProposalToastContext";
import DaoTracker from "@/components/DaoTracker";
import AnalyticsPageTracker from "@/components/AnalyticsPageTracker";

function TransactionHandler() {
  useTransactionHandler();
  return null;
}

export default function DaoLayout({ children }) {
  return (
    <ProposalToastProvider>
      <Suspense fallback={null}>
        <TransactionHandler />
        <AnalyticsPageTracker />
      </Suspense>
      <DaoTracker />
      {children}
    </ProposalToastProvider>
  );
}
