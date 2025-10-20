"use client";

const RejectedStatus = ({ height, width }) => (
  <svg
    width={width ?? 21}
    height={height ?? 20}
    viewBox="0 0 32 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="16" cy="16.5" r="16" fill="var(--other-red)" />
    <path
      d="M22 10.5L10 22.5"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 10.5L22 22.5"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default RejectedStatus;
