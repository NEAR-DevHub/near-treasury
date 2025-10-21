"use client";

import { useState } from "react";
import NearTreasuryLogo from "@/components/icons/Logo";
import { validateDaoId } from "@/helpers/daoValidation";

const DaoSelector = () => {
  const [daoId, setDaoId] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!daoId.trim()) return;

    setIsValidating(true);
    setValidationError("");

    const validation = await validateDaoId(daoId);

    setIsValidating(false);

    if (validation.isValid) {
      // Navigate to the DAO dashboard
      window.location.href = `/${validation.daoId}/dashboard`;
    } else {
      setValidationError(validation.error || "Validation failed");
    }
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
                      className={`form-control ${
                        validationError ? "is-invalid" : ""
                      }`}
                      id="daoId"
                      value={daoId}
                      onChange={(e) => {
                        setDaoId(e.target.value);
                        if (validationError) setValidationError("");
                      }}
                      placeholder="e.g., treasury.sputnik-dao.near"
                      required
                    />
                    {validationError && (
                      <div className="invalid-feedback">{validationError}</div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn theme-btn w-100"
                    disabled={!daoId.trim() || isValidating}
                  >
                    {isValidating ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Validating...
                      </>
                    ) : (
                      "Access Treasury"
                    )}
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
