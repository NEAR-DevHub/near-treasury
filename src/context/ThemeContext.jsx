"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#01BF7A");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME);
    if (savedTheme) {
      setIsDarkTheme(savedTheme === "dark");
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkTheme) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [isDarkTheme]);

  // Convert hex to HSL
  const hexToHsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
        default:
          h = 0;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  const applyThemeColors = (primaryColor) => {
    const root = document.documentElement;
    root.style.setProperty("--theme-color", primaryColor);

    // Calculate and set dark variant
    const [h, s, l] = hexToHsl(primaryColor);
    const darkL = Math.max(0, l - 20); // Darken by 10%
    root.style.setProperty("--theme-color-dark", `hsl(${h}, ${s}%, ${darkL}%)`);
  };

  // Apply dynamic primary color
  useEffect(() => {
    applyThemeColors(primaryColor);
  }, [primaryColor]);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.THEME,
      isDarkTheme ? "dark" : "light"
    );
  }, [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const value = {
    isDarkTheme,
    primaryColor,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
