"use client";

import { useState, useEffect } from "react";

const Copy = ({
  label,
  clipboardText,
  showLogo = true,
  className = "",
  checkLogoClass = "",
  copyLogoClass = "",
}) => {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;

    const timer = setTimeout(() => setIsCopied(false), 2000);

    return () => clearTimeout(timer);
  }, [isCopied]);

  return (
    <div>
      <div
        data-testid="copy-button"
        className={className}
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(clipboardText);
          setIsCopied(true);
        }}
      >
        {showLogo && isCopied ? (
          <i className={"bi bi-check-lg " + checkLogoClass} />
        ) : (
          <i className={"bi bi-copy " + copyLogoClass} />
        )}
        {label && isCopied ? "Copied" : label}
      </div>
    </div>
  );
};

export default Copy;
