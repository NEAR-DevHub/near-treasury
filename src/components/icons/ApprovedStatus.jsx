"use client";

const ApprovedStatus = ({ height, width }) => (
  <svg
    width={width ?? 20}
    height={height ?? 20}
    viewBox="0 0 32 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="16.5" cy="16.5" r="16" fill="var(--other-green)" />
    <path
      d="M24.5 10.5L13.5 21.5L8.5 16.5"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ApprovedStatus;
