"use client";

/**
 * Optimized DropDown Component
 * Reusable dropdown component with Bootstrap styling
 * Fully controlled component - parent manages state
 *
 * @param {Array} options - Array of {label, value, description} objects
 * @param {Function} onUpdate - Callback when selection changes
 * @param {Object|string} selectedValue - Currently selected value
 * @param {boolean} disabled - Disable the dropdown
 * @param {string} defaultLabel - Default label when nothing selected
 * @param {Function} DropdownItemRender - Custom render function for dropdown items
 * @param {Function} SelectedValueRender - Custom render function for selected value
 * @param {string} dataTestId - Test ID for the dropdown
 */
const DropDown = ({
  options = [],
  onUpdate,
  selectedValue,
  disabled = false,
  defaultLabel = "Select",
  DropdownItemRender = null,
  SelectedValueRender = null,
  dataTestId,
}) => {
  // Default item renderer
  const DefaultItemRender = ({ item, onClick }) => (
    <li
      className="dropdown-item cursor-pointer link-underline link-underline-opacity-0 rounded"
      onClick={onClick}
      style={{
        whiteSpace: "normal",
        wordBreak: "break-word",
        cursor: "pointer",
      }}
    >
      {item.label}
    </li>
  );

  const handleItemClick = (item) => {
    if (onUpdate) {
      onUpdate(item);
    }
  };

  return (
    <div>
      <div className="dropdown w-100" data-testid={dataTestId}>
        <button
          disabled={disabled}
          className="btn dropdown-toggle bg-dropdown border rounded-2 w-100 text-start d-flex align-items-center justify-content-between"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          data-testid={`${dataTestId}-btn`}
        >
          <span className="text-truncate">
            {SelectedValueRender ? (
              <SelectedValueRender />
            ) : (
              selectedValue?.label || defaultLabel
            )}
          </span>
          <i className="bi bi-chevron-down ms-2"></i>
        </button>
        <ul className="dropdown-menu dropdown-menu-end dropdown-menu-lg-start px-2 shadow w-100">
          {options.map((item, index) =>
            DropdownItemRender ? (
              <DropdownItemRender
                key={item.value || index}
                item={item}
                onSelect={handleItemClick}
                selected={selectedValue}
              />
            ) : (
              <DefaultItemRender
                key={item.value || index}
                item={item}
                onClick={() => handleItemClick(item)}
              />
            )
          )}
        </ul>
      </div>
      {selectedValue?.description && (
        <div className="text-secondary small mt-1">
          {selectedValue.description}
        </div>
      )}
    </div>
  );
};

export default DropDown;
