"use client";

import { useDao } from "@/context/DaoContext";
import DepositAddress from "@/app/[daoId]/dashboard/intents-deposit/DepositAddress";

const SputnikDao = () => {
  const { daoId } = useDao();

  return (
    <div
      className="card card-body d-flex flex-column gap-2 text-left mx-auto"
      style={{ maxWidth: "800px", fontSize: "14px" }}
    >
      <div className="h4 mb-0">Sputnik DAO</div>
      <div style={{ fontWeight: 500 }}>
        Best for tokens on NEAR with full treasury control: payments, staking,
        asset exchange and lockups.
      </div>
      <div className="mt-2">
        <DepositAddress
          address={daoId}
          warningMessage="Only deposit from the NEAR network."
        />
      </div>
    </div>
  );
};

export default SputnikDao;
