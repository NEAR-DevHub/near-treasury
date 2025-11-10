import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { getProposalsFromIndexer } from "@/api/indexer";
import { useDebounce } from "./useDebounce";
import { REFRESH_DELAY } from "@/constants/ui";

/**
 * Custom hook to fetch and manage proposals with React Query
 *
 * @param {Object} options - Query options
 * @param {string} options.category - Proposal category (e.g., "payments", "stake-delegation")
 * @param {Array<string>} options.statuses - Proposal statuses to filter
 * @param {number} options.page - Current page number (0-indexed)
 * @param {number} options.pageSize - Number of items per page
 * @param {string} options.sortDirection - Sort direction ("asc" or "desc")
 * @param {Object} options.filters - Filter object
 * @param {string} options.search - Search query
 * @param {Object} options.amountValues - Amount filter values
 * @param {Array<string>} options.proposalType - Proposal types to filter
 * @param {boolean} options.enabled - Whether the query should run
 *
 * @returns {Object} Query result with proposals, loading state, error, and refetch function
 */
export function useProposals({
  category,
  statuses = [],
  page = 0,
  pageSize = 10,
  sortDirection = "desc",
  filters = {},
  search = "",
  amountValues = {},
  proposalType = [],
  enabled = true,
} = {}) {
  const { daoId } = useDao();
  const { accountId } = useNearWallet();
  const queryClient = useQueryClient();

  // Debounced values using custom hook
  const debouncedSearch = useDebounce(search, 500);
  const debouncedAmountValues = useDebounce(amountValues, 1000);

  // Normalize filters to only include filters with actual values
  const normalizedFilters = Object.keys(filters).reduce((acc, key) => {
    const filter = filters[key];
    if (filter && filter.values && filter.values.length > 0) {
      const nonEmptyValues = filter.values.filter((v) => v && v !== "");
      if (nonEmptyValues.length > 0) {
        acc[key] = { ...filter, values: nonEmptyValues };
      }
    }
    return acc;
  }, {});

  // Normalize amount values to only include non-empty values
  const normalizedAmountValues = Object.keys(debouncedAmountValues).reduce(
    (acc, key) => {
      if (
        key !== "value" &&
        debouncedAmountValues[key] &&
        debouncedAmountValues[key] !== ""
      ) {
        acc[key] = debouncedAmountValues[key];
      } else if (key === "value") {
        acc[key] = debouncedAmountValues[key];
      }
      return acc;
    },
    {}
  );

  const queryKey = [
    "proposals",
    daoId,
    category,
    proposalType,
    statuses,
    page,
    pageSize,
    sortDirection,
    normalizedFilters,
    debouncedSearch?.trim() || "",
    normalizedAmountValues,
    accountId,
  ];

  const query = useQuery({
    queryKey,
    queryFn: () =>
      getProposalsFromIndexer({
        daoId,
        category,
        statuses,
        page,
        pageSize,
        sortDirection,
        filters,
        search: debouncedSearch,
        amountValues: debouncedAmountValues,
        proposalType,
        accountId,
      }),
    enabled: enabled && !!daoId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Helper function to invalidate this specific query
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  // Helper function to invalidate all proposals for this category
  const invalidateCategory = () => {
    queryClient.invalidateQueries({
      queryKey: ["proposals", daoId, category],
    });
  };

  // Helper function to invalidate category with delay for indexer processing
  // This should be used after add_proposal or act_proposal transactions
  const invalidateCategoryAfterTransaction = () => {
    return new Promise((resolve) => {
      // Delay cache invalidation to give the indexer time to process the transaction
      // This prevents a race condition where the refetch happens before indexing completes
      setTimeout(() => {
        invalidateCategory();
        resolve();
      }, REFRESH_DELAY);
    });
  };

  // Helper function to invalidate all proposals for this DAO
  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["proposals", daoId],
    });
  };

  return {
    proposals: query.data?.proposals || [],
    total: query.data?.total || 0,
    url: query.data?.url,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidate,
    invalidateCategory,
    invalidateCategoryAfterTransaction,
    invalidateAll,
  };
}
