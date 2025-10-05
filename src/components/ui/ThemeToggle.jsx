"use client";

import { useTheme } from "../../context/ThemeContext";

const ThemeToggle = () => {
  const { isDarkTheme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="btn btn-outline-secondary">
      {isDarkTheme ? (
        <i className="bi bi-sun-fill"></i>
      ) : (
        <i className="bi bi-moon-fill"></i>
      )}
    </button>
  );
};

export default ThemeToggle;
