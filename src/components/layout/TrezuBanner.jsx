"use client";

import { useEffect, useState } from "react";
import { useDao } from "@/context/DaoContext";

const TREZU_URL = "https://trezu.org/";

const TrezuBanner = ({ showClose = false }) => {
  const { daoId } = useDao();
  const targetUrl = daoId ? `https://trezu.app/${daoId}` : TREZU_URL;
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsDismissed(false);
  }, [daoId, showClose]);

  if (showClose && isDismissed) {
    return null;
  }

  return (
    <div className="trezu-banner-wrapper px-3 px-md-4 py-3">
      <div className="trezu-banner d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <p className="trezu-banner-text mb-0">
          NEAR Treasury is an open source project and is no longer actively
          maintained. We recommend switching to Trezu.
        </p>
        <div className="trezu-banner-actions d-flex align-items-center gap-2">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn trezu-banner-btn d-inline-flex align-items-center gap-2"
          >
            Go to Trezu
            <i className="bi bi-arrow-up-right text-white"></i>
          </a>
          {showClose && (
            <button
              type="button"
              className="trezu-banner-close btn p-0 border-0 bg-transparent"
              aria-label="Close banner"
              onClick={() => setIsDismissed(true)}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrezuBanner;
