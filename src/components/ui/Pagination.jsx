"use client";

import DropDown from "@/components/dropdowns/DropDown";

const Pagination = ({
  onNextClick = () => {},
  onPrevClick = () => {},
  onRowsChange = () => {},
  totalPages,
  totalLength,
  rowsPerPage,
  currentPage,
}) => {
  const paginationOptions = [
    { label: 10, value: 10 },
    { label: 20, value: 20 },
    { label: 30, value: 30 },
  ];

  const page = currentPage;
  const displayCurrentPage = page + 1;
  const currentPageLimit =
    totalLength <= displayCurrentPage * rowsPerPage
      ? totalLength
      : displayCurrentPage * rowsPerPage;

  return (
    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap px-3 text-color">
      <div className="d-flex gap-2 align-items-center">
        Rows per Page:
        <DropDown
          options={paginationOptions}
          selectedValue={
            isNaN(rowsPerPage)
              ? paginationOptions[0]
              : paginationOptions.find((o) => o.value === rowsPerPage)
          }
          onUpdate={({ value }) => onRowsChange(value)}
        />
      </div>
      <div className="d-flex gap-2 align-items-center">
        Showing: {displayCurrentPage * rowsPerPage - rowsPerPage + 1} -{" "}
        {currentPageLimit} of {totalLength}
        <button
          className="btn btn-outline-secondary"
          disabled={page === 0}
          onClick={onPrevClick}
        >
          <i className="bi bi-arrow-left h5 mb-0"></i>
        </button>
        <button
          className="btn btn-outline-secondary"
          disabled={displayCurrentPage === totalPages}
          onClick={onNextClick}
        >
          <i className="bi bi-arrow-right h5 mb-0"></i>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
