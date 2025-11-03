"use client";

import { Suspense } from "react";
import HomePage from "./HomePage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center min-vh-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
