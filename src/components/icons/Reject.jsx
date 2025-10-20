"use client";

const Reject = ({ height, width, hideStroke }) => (
  <svg
    width={width ?? 21}
    height={height ?? 20}
    viewBox="0 0 21 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="10.5"
      cy="10"
      r="9"
      fill="var(--other-red)"
      stroke="var(--bg-page-color)"
      strokeWidth={hideStroke ? "0" : "2"}
    />
    <path
      d="M13.5 7L7.5 13"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 7L13.5 13"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Reject;
