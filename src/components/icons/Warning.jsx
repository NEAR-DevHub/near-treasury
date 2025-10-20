"use client";

const Warning = ({ height, width }) => (
  <svg
    width={width ?? 21}
    height={height ?? 20}
    viewBox="0 0 32 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.4801 3.16675H21.5201L29.3334 10.9801V22.0201L21.5201 29.8334H10.4801L2.66675 22.0201V10.9801L10.4801 3.16675Z"
      stroke="var(--other-warning)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 11.1667V16.5001"
      stroke="var(--other-warning)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 21.8333H16.0133"
      stroke="var(--other-warning)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Warning;
