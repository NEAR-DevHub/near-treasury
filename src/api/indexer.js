import { logger } from "@/helpers/logger";

const SPUTNIK_INDEXER_BASE = process.env.NEXT_PUBLIC_SPUTNIK_INDEXER;
/**
 * Get list of approvers for a DAO's proposals
 */
export const getProposalApprovers = async (daoId) => {
  try {
    logger.info("Indexer call: getProposalApprovers", { daoId });
    const response = await fetch(
      `${SPUTNIK_INDEXER_BASE}/proposals/${daoId}/approvers`
    );
    const data = await response.json();
    return data?.approvers || [];
  } catch (error) {
    logger.error("Error getting proposal approvers:", error);
    return [];
  }
};

/**
 * Get list of recipients for a DAO's proposals
 */
export const getProposalRecipients = async (daoId) => {
  try {
    logger.info("Indexer call: getProposalRecipients", { daoId });
    const response = await fetch(
      `${SPUTNIK_INDEXER_BASE}/proposals/${daoId}/recipients`
    );
    const data = await response.json();
    return data?.recipients || [];
  } catch (error) {
    logger.error("Error getting proposal recipients:", error);
    return [];
  }
};

/**
 * Get list of requested tokens for a DAO's proposals
 */
export const getProposalRequestedTokens = async (daoId) => {
  try {
    logger.info("Indexer call: getProposalRequestedTokens", { daoId });
    const response = await fetch(
      `${SPUTNIK_INDEXER_BASE}/proposals/${daoId}/requested-tokens`
    );
    const data = await response.json();
    return data?.requested_tokens || [];
  } catch (error) {
    logger.error("Error getting requested tokens:", error);
    return [];
  }
};

/**
 * Get list of proposers for a DAO's proposals
 */
export const getProposalProposers = async (daoId) => {
  try {
    logger.info("Indexer call: getProposalProposers", { daoId });
    const response = await fetch(
      `${SPUTNIK_INDEXER_BASE}/proposals/${daoId}/proposers`
    );
    const data = await response.json();
    return data?.proposers || [];
  } catch (error) {
    logger.error("Error getting proposal proposers:", error);
    return [];
  }
};

/**
 * Get list of validators for a DAO's stake delegation proposals
 */
export const getProposalValidators = async (daoId) => {
  try {
    logger.info("Indexer call: getProposalValidators", { daoId });
    const response = await fetch(
      `${SPUTNIK_INDEXER_BASE}/proposals/${daoId}/validators`
    );
    const data = await response.json();
    return data?.validators || [];
  } catch (error) {
    logger.error("Error getting proposal validators:", error);
    return [];
  }
};

/**
 * Generate filtered proposals query parameters
 */
export function generateFilteredProposalsQuery(
  filters,
  accountId,
  amountValues,
  search,
  searchNot
) {
  let queryParams = [];

  // Handle search parameter
  if (search && search.trim()) {
    queryParams.push(`search=${encodeURIComponent(search.trim())}`);
  }

  // Handle search_not parameter
  if (searchNot && searchNot.trim()) {
    queryParams.push(`search_not=${encodeURIComponent(searchNot.trim())}`);
  }

  // Handle filters object
  if (filters && typeof filters === "object") {
    // Iterate through each filter key
    Object.keys(filters).forEach((filterKey) => {
      const filter = filters[filterKey];

      if (filter && filter.values && filter.values.length > 0) {
        const values = filter.values.filter((value) => value && value !== "");

        if (values.length > 0) {
          const include = filter.include !== false;

          // Map filter keys to URL parameters
          switch (filterKey) {
            case "status":
              if (include) {
                queryParams.push(`statuses=${values.join(",")}`);
              } else {
                const allStatuses = [
                  "Approved",
                  "Rejected",
                  "Failed",
                  "Expired",
                ];
                const excludedStatuses = values;
                const includedStatuses = allStatuses.filter(
                  (status) => !excludedStatuses.includes(status)
                );
                queryParams.push(`statuses=${includedStatuses.join(",")}`);
              }
              break;

            case "proposers":
              if (include) {
                queryParams.push(`proposers=${values.join(",")}`);
              } else {
                queryParams.push(`proposers_not=${values.join(",")}`);
              }
              break;

            case "approvers":
              if (include) {
                queryParams.push(`approvers=${values.join(",")}`);
              } else {
                queryParams.push(`approvers_not=${values.join(",")}`);
              }
              break;

            case "recipients":
              if (include) {
                queryParams.push(`recipients=${values.join(",")}`);
              } else {
                queryParams.push(`recipients_not=${values.join(",")}`);
              }
              break;

            case "token":
              if (include) {
                queryParams.push(`tokens=${values.join(",")}`);
              } else {
                queryParams.push(`tokens_not=${values.join(",")}`);
              }
              break;

            case "created_date":
              const originalValues = filter.values;
              const fromDate = originalValues[0];
              const toDate = originalValues[1];

              if (fromDate && toDate) {
                queryParams.push(
                  `created_date_from=${fromDate}&created_date_to=${toDate}`
                );
              } else if (fromDate) {
                queryParams.push(`created_date_from=${fromDate}`);
              } else if (toDate) {
                queryParams.push(`created_date_to=${toDate}`);
              }
              break;

            case "votes":
              if (include) {
                if (values[0] === "Approved") {
                  queryParams.push(`voter_votes=${accountId}:approved`);
                } else if (values[0] === "Rejected") {
                  queryParams.push(`voter_votes=${accountId}:rejected`);
                } else if (
                  values[0] === "Awaiting Decision" ||
                  values[0] === "Not Voted"
                ) {
                  const existingApproversNotIndex = queryParams.findIndex(
                    (param) => param.startsWith("approvers_not=")
                  );
                  if (existingApproversNotIndex !== -1) {
                    const existingParam =
                      queryParams[existingApproversNotIndex];
                    const existingValues = existingParam
                      .split("=")[1]
                      .split(",");
                    const allValues = [
                      ...new Set([...existingValues, accountId]),
                    ];
                    queryParams[existingApproversNotIndex] =
                      `approvers_not=${allValues.join(",")}`;
                  } else {
                    queryParams.push(`approvers_not=${accountId}`);
                  }
                }
              } else {
                if (values[0] === "Approved") {
                  queryParams.push(`voter_votes=${accountId}:rejected`);
                } else if (values[0] === "Rejected") {
                  queryParams.push(`voter_votes=${accountId}:approved`);
                } else if (
                  values[0] === "Awaiting Decision" ||
                  values[0] === "Not Voted"
                ) {
                  queryParams.push(`approvers=${accountId}`);
                }
              }
              break;

            case "type":
              if (include) {
                queryParams.push(`stake_type=${values[0].toLowerCase()}`);
              } else {
                queryParams.push(`stake_type_not=${values[0].toLowerCase()}`);
              }
              break;

            case "validators":
              if (include) {
                queryParams.push(`validators=${values.join(",")}`);
              } else {
                queryParams.push(`validators_not=${values.join(",")}`);
              }
              break;

            case "source":
              const sourceValue = values[0].toLowerCase().split(" ").join("-");
              if (include) {
                queryParams.push("source=" + sourceValue);
              } else {
                queryParams.push("source_not=" + sourceValue);
              }
              break;
            default:
              break;
          }
        }
      }
    });
  }

  // Handle amount values
  if (amountValues) {
    if (amountValues.min && amountValues.min !== "") {
      queryParams.push(`amount_min=${amountValues.min}`);
    }
    if (amountValues.max && amountValues.max !== "") {
      queryParams.push(`amount_max=${amountValues.max}`);
    }
    if (amountValues.equal && amountValues.equal !== "") {
      queryParams.push(`amount_equal=${amountValues.equal}`);
    }
  }

  return queryParams.join("&");
}

/**
 * Get proposals from indexer with filters and pagination
 */
export const getProposalsFromIndexer = async ({
  daoId,
  category,
  page = 0,
  pageSize = 10,
  statuses,
  proposalType,
  sortDirection = "desc",
  filters,
  search,
  searchNot,
  amountValues,
  accountId,
}) => {
  try {
    let query = `${SPUTNIK_INDEXER_BASE}/proposals/${daoId}?page=${page}&page_size=${pageSize}&sort_by=CreationTime&sort_direction=${sortDirection}`;

    if (category && category.length > 0) {
      query += `&category=${category}`;
    }
    if (proposalType && proposalType.length > 0) {
      query += `&proposal_types=${proposalType.join(",")}`;
    }

    // Handle statuses - use filters.statuses if available, otherwise use statuses parameter
    let hasStatusesInFilters = false;
    if (
      filters &&
      filters.status &&
      filters.status.values &&
      filters.status.values.length > 0
    ) {
      hasStatusesInFilters = true;
    }

    if (!hasStatusesInFilters && statuses && statuses.length > 0) {
      query += `&statuses=${statuses.join(",")}`;
    }

    // Add filter-related query parameters (including search and search_not)
    const filterQueryParams = generateFilteredProposalsQuery(
      filters,
      accountId,
      amountValues,
      search,
      searchNot
    );
    if (filterQueryParams) {
      query += `&${filterQueryParams}`;
    }

    logger.info("Indexer call: getProposalsFromIndexer", {
      daoId,
      category,
      page,
    });

    const response = await fetch(query);
    const data = await response.json();

    return {
      proposals: data?.proposals || [],
      total: data?.total || 0,
      url: query,
    };
  } catch (error) {
    logger.error("Error getting proposals from indexer:", error);
    return {
      proposals: [],
      total: 0,
      url: null,
    };
  }
};
