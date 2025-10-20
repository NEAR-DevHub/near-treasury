"use client";

import { QRCodeSVG } from "qrcode.react";

const QRCode = ({
  value,
  size = 128,
  level = "M",
  includeMargin = false,
  className = "",
}) => {
  return (
    <div className={`d-inline-block ${className}`}>
      <QRCodeSVG
        value={value}
        size={size}
        level={level}
        includeMargin={includeMargin}
        bgColor="transparent"
        fgColor="var(--text-color)"
        style={{
          borderRadius: "5px",
        }}
      />
    </div>
  );
};

export default QRCode;
