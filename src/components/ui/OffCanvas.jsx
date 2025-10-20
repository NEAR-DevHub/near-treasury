"use client";

const OffCanvas = ({
  showCanvas,
  onClose,
  title,
  children,
  disableScroll = false,
}) => {
  return (
    <>
      <div className={`fade ${showCanvas ? "modal-backdrop show" : ""}`} />
      <div
        className={`offcanvas offcanvas-end ${showCanvas ? "show" : ""}`}
        style={{
          overflow: disableScroll ? "hidden" : "auto",
          visibility: showCanvas ? "visible" : "hidden",
        }}
        tabIndex="-1"
        data-bs-scroll="false"
        data-bs-backdrop="true"
      >
        <div className="p-3 d-flex gap-2 align-items-end pb-0">
          <button
            onClick={onClose}
            type="button"
            className="btn-close"
            style={{ opacity: 1, height: 20 }}
          ></button>
          <h5 className="offcanvas-title" id="offcanvasLabel">
            {title}
          </h5>
        </div>

        {showCanvas && (
          <div className="offcanvas-body d-flex flex-column gap-4 h-100 w-100">
            {children}
          </div>
        )}
      </div>
    </>
  );
};

export default OffCanvas;
