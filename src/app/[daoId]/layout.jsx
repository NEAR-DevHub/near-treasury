"use client";

import { Suspense } from "react";
import { useTransactionHandler } from "@/hooks/useTransactionHandler";
import { ProposalToastProvider } from "@/context/ProposalToastContext";

function TransactionHandler() {
  useTransactionHandler();
  return null;
}

export default function DaoLayout({ children }) {
  return (
    <ProposalToastProvider>
      <Suspense fallback={null}>
        <TransactionHandler />
      </Suspense>
      {children}
    </ProposalToastProvider>
  );
}
