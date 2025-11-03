"use client";

import { useTransactionHandler } from "@/hooks/useTransactionHandler";

export default function DaoLayout({ children }) {
  // Handle transaction redirects and show toasts globally for all DAO pages
  useTransactionHandler();

  return <>{children}</>;
}
