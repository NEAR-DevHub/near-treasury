"use client";

const Skeleton = ({ style, className, children, ...props }) => {
  return (
    <div className={`skeleton ${className || ""}`} style={style} {...props}>
      {children}
    </div>
  );
};

export default Skeleton;
