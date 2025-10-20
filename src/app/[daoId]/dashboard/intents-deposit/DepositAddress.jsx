"use client";

import QRCode from "@/components/ui/QRCode";
import Copy from "@/components/ui/Copy";

const DepositAddress = ({ address, warningMessage }) => {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="card card-body">
        <div className="d-flex gap-3">
          <QRCode value={address} size={120} />

          <div className="w-75 text-truncate d-flex flex-column gap-2">
            <div className="mb-0 h6 text-secondary">Address</div>
            <div className="d-flex pe-1">
              <div className="text-truncate">{address}</div>
              <div style={{ flexShrink: 0 }}>
                <Copy
                  label=""
                  clipboardText={address}
                  className="px-2"
                  showLogo={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 warning-box rounded-3 d-flex flex-column gap-1">
        <div className="fw-bold">{warningMessage}</div>
        <div>
          Deposits of other networks will be lost. We recommend starting with a
          small test transaction to ensure everything works correctly before
          sending the full amount.
        </div>
      </div>
    </div>
  );
};

export default DepositAddress;
