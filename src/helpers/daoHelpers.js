/**
 * DAO and proposal-related helper functions
 */

import { parseKeyToReadableFormat } from "@/helpers/formatters";
import Big from "big.js";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";

/**
 * Encode data object to markdown format for DAO proposals
 */
export const encodeToMarkdown = (data) => {
  return Object.entries(data)
    .filter(([key, value]) => {
      return (
        key && // Key exists and is not null/undefined
        value !== null &&
        value !== undefined &&
        value !== ""
      );
    })
    .map(([key, value]) => {
      return `* ${parseKeyToReadableFormat(key)}: ${String(value)}`;
    })
    .join(" <br>");
};

/**
 * Decode proposal description to extract specific key value
 * Supports both JSON and markdown formats
 */
export const decodeProposalDescription = (key, description) => {
  // Try to parse as JSON
  let parsedData;
  try {
    parsedData = JSON.parse(description);
    if (parsedData && parsedData[key] !== undefined) {
      return parsedData[key]; // Return value from JSON if key exists
    }
  } catch (error) {
    // Not JSON, proceed to parse as markdown
  }

  // Handle as markdown
  const markdownKey = parseKeyToReadableFormat(key);

  const lines = description.split("<br>");
  for (const line of lines) {
    if (line.startsWith("* ")) {
      const rest = line.slice(2);
      const indexOfColon = rest.indexOf(":");
      if (indexOfColon !== -1) {
        const currentKey = rest.slice(0, indexOfColon).trim();
        const value = rest.slice(indexOfColon + 1).trim();

        if (currentKey.toLowerCase() === markdownKey.toLowerCase()) {
          return value;
        }
      }
    }
  }

  return null; // Return null if key not found
};

/**
 * Decode base64 encoded proposal arguments
 */
export const decodeBase64 = (encodedArgs) => {
  if (!encodedArgs) return null;
  try {
    const jsonString = Buffer.from(encodedArgs, "base64").toString("utf8");
    const parsedArgs = JSON.parse(jsonString);
    return parsedArgs;
  } catch (error) {
    console.error("Failed to decode or parse encodedArgs:", error);
    return null;
  }
};

  export const formatSubmissionTimeStamp = (
  submissionTime,
  proposalPeriod,
  isProposalDetailsPage
) => {
  const endTime = Big(submissionTime ?? "0")
    .plus(proposalPeriod ?? "0")
    .toFixed();
  const milliseconds = Number(endTime) / 1000000;
  const date = new Date(milliseconds);

  // Calculate days and minutes remaining from the timestamp
  const now = new Date();
  let diffTime = date - now;

  // Check if the difference is negative
  const isNegative = diffTime < 0;

  // Convert the total difference into days, hours, and minutes
  const totalMinutes = Math.floor(diffTime / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const totalDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  return isProposalDetailsPage ? (
    <div className={isNegative && "text-secondary"}>
      <DateTimeDisplay timestamp={milliseconds} />
     
    </div>
  ) : (
    <div className="d-flex flex-wrap">
      <div className="fw-bold">
        {isNegative
          ? "Expired"
          : `${totalDays}d ${remainingHours}h ${remainingMinutes}m`}

        <div className="text-secondary text-sm">
        <DateTimeDisplay timestamp={milliseconds} format="date-only"/>
         
        </div>
      </div>
    </div>
  );
}
