"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useDao } from "@/context/DaoContext";
import { trackDaoVisit, setCurrentDao } from "@/lib/gtag";

export default function DaoTracker() {
  const { daoId } = useDao();
  const pathname = usePathname();

  useEffect(() => {
    // Only track if we have a valid, validated DAO ID from DaoContext
    if (!daoId) return;

    // Set the current DAO as a user property for the session
    setCurrentDao(daoId);

    // Extract page type (section) from pathname
    // e.g., "/astradao.sputnik-dao.near/payments" -> "payments"
    const pathParts = pathname.split("/");
    const daoIndex = pathParts.indexOf(daoId);
    const pageType =
      daoIndex !== -1 && pathParts[daoIndex + 1]
        ? pathParts[daoIndex + 1]
        : "dashboard";

    // Track the DAO visit with page type
    trackDaoVisit(daoId, pathname, pageType);
  }, [daoId, pathname]);

  return null;
}
