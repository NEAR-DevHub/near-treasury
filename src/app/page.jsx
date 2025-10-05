"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NearTreasuryLogo from "@/components/ui/Logo";

const DaoSelector = () => {
  const [daoId, setDaoId] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!daoId.trim()) return;

    // Navigate to the DAO dashboard
    router.push(`/${daoId.trim()}/dashboard`);
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="text-center mb-3">
              <NearTreasuryLogo />
              <p className="text-secondary">
                Enter a DAO ID to access your treasury
              </p>
            </div>

            <div className="card border">
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="daoId" className="form-label">
                      DAO ID
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="daoId"
                      value={daoId}
                      onChange={(e) => setDaoId(e.target.value)}
                      placeholder="e.g., treasury.sputnik-dao.near"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn theme-btn w-100"
                    disabled={!daoId.trim()}
                  >
                    Access Treasury
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DaoSelector;
