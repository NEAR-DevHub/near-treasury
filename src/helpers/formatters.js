/**
 * Generic formatting and parsing utilities
 */

/**
 * Normalize text for URL slugs and identifiers
 */
export const normalize = (text) =>
  text
    ? text
        .replaceAll(/[- \.]/g, "_")
        .replaceAll(/[^\w]+/g, "")
        .replaceAll(/_+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "")
        .toLowerCase()
        .trim("-")
    : "";

/**
 * Format amount to currency string
 */
export const formatCurrency = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  } catch (error) {
    console.error("Error formatting currency:", error);
    return `$${amount}`;
  }
};

/**
 * Parse HTML string to plain text
 */
export const parseString = (string) => {
  if (!string) return "";

  // Remove HTML tags
  const withoutTags = string.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };

  return withoutTags.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;/g,
    (match) => entities[match]
  );
};

/**
 * Parse key to readable format (snake_case/camelCase -> Title Case)
 */
export const parseKeyToReadableFormat = (key) => {
  return key
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Add spaces between camelCase or PascalCase words
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize each word
};

/**
 * Check if string is 64-character hexadecimal (implicit account)
 */
export const isHex64 = (str) => /^[0-9a-fA-F]{64}$/.test(str);

/**
 * Parse amount string supporting both comma and dot as decimal separators
 * Handles formats like: "1,000.50", "1.000,50", "0,001", "0.001", "1000"
 *
 * @param {string} amountStr - The amount string to parse
 * @returns {number} The parsed number, or NaN if invalid
 *
 * @example
 * parseAmount("0,001")      // 0.001 (European decimal)
 * parseAmount("0.001")      // 0.001 (US decimal)
 * parseAmount("1,000.50")   // 1000.50 (US format with thousand separator)
 * parseAmount("1.000,50")   // 1000.50 (European format with thousand separator)
 * parseAmount("1000")       // 1000 (plain number)
 */
export function parseAmount(amountStr) {
  if (!amountStr) return NaN;

  const str = amountStr.trim();

  // Count dots and commas
  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  // If no separators, it's a simple number
  if (dotCount === 0 && commaCount === 0) {
    return parseFloat(str);
  }

  // If only commas
  if (dotCount === 0 && commaCount > 0) {
    // Check if comma is used as decimal separator (European format)
    // Pattern: ends with comma followed by 1-3 digits
    if (/,\d{1,3}$/.test(str)) {
      // European decimal: "0,001" or "1,5"
      return parseFloat(str.replace(",", "."));
    } else {
      // Thousand separator: "1,000" or "10,000,000"
      return parseFloat(str.replace(/,/g, ""));
    }
  }

  // If only dots
  if (commaCount === 0 && dotCount > 0) {
    // Check if dot is used as thousand separator (European format)
    if (dotCount > 1 || /\.\d{3}(?=\d)/.test(str)) {
      // European thousand separator: "1.000" or "1.000.000"
      return parseFloat(str.replace(/\./g, ""));
    } else {
      // US decimal: "0.001" or "1.5"
      return parseFloat(str);
    }
  }

  // If both dots and commas exist
  if (dotCount > 0 && commaCount > 0) {
    const lastDotIndex = str.lastIndexOf(".");
    const lastCommaIndex = str.lastIndexOf(",");

    if (lastCommaIndex > lastDotIndex) {
      // Comma is the decimal separator: "1.000,50"
      return parseFloat(str.replace(/\./g, "").replace(",", "."));
    } else {
      // Dot is the decimal separator: "1,000.50"
      return parseFloat(str.replace(/,/g, ""));
    }
  }

  return parseFloat(str);
}
