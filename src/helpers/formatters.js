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
 * Format amount to readable format with commas and 2 decimals
 */
export function formatAmountToReadableFormat(amount) {
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

