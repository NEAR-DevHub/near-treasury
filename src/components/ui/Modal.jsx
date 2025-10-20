"use client";

/**
 * Simple Modal Component
 * Parent components pass content and footer buttons as children
 *
 * @param {boolean} isOpen - Whether modal is open
 * @param {string} heading - Modal title
 * @param {ReactNode} children - Modal body content
 * @param {ReactNode} footer - Modal footer content (buttons, etc.)
 * @param {Function} onClose - Close button callback
 * @param {string} size - Modal size: 'sm', 'lg', 'xl', or default
 */
const Modal = ({ isOpen, heading, children, footer, onClose, size = null }) => {
  if (!isOpen) return null;

  const sizeClass = size ? `modal-${size}` : "";

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      tabIndex="-1"
      onClick={onClose}
    >
      <div
        className={`modal-dialog modal-dialog-centered ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{heading}</h5>
            <button
              type="button"
              className="btn-close text-color"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

export default Modal;
