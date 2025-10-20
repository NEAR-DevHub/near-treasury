"use client";

const Approval = ({ height, width, hideStroke }) => (
  <svg
    width={width ?? 20}
    height={height ?? 20}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="10"
      cy="10"
      r="9"
      fill="var(--other-green)"
      stroke="var(--bg-page-color)"
      strokeWidth={hideStroke ? "0" : "2"}
    />
    <path
      d="M14 7L8.5 12.5L6 10"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Approval;
