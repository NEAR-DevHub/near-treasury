const UnstakeIcon = ({ height, width }) => (
  <svg
    width={width ?? 20}
    height={height ?? 20}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.8333 9.1665H4.16667C3.24619 9.1665 2.5 9.9127 2.5 10.8332V16.6665C2.5 17.587 3.24619 18.3332 4.16667 18.3332H15.8333C16.7538 18.3332 17.5 17.587 17.5 16.6665V10.8332C17.5 9.9127 16.7538 9.1665 15.8333 9.1665Z"
      stroke="var(--icon-color)"
      strokeWidth="1.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.83325 9.16679V5.83346C5.83222 4.80017 6.21515 3.80335 6.90773 3.03652C7.60031 2.26968 8.55311 1.78755 9.58117 1.6837C10.6092 1.57986 11.6392 1.86171 12.4711 2.47456C13.3031 3.0874 13.8776 3.9875 14.0833 5.00013"
      stroke="var(--icon-color)"
      strokeWidth="1.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default UnstakeIcon;
