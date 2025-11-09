import { useQuery } from "@tanstack/react-query";
import { useDao } from "@/context/DaoContext";
import { Near } from "@/api/near";

/**
 * Custom hook to fetch a single proposal with React Query
 *
 * @param {number} proposalId - The proposal ID to fetch
 *
 * @returns {Object} Query result with proposal data, loading state, and error
 */
export function useProposal(proposalId) {
  const { daoId } = useDao();

  const query = useQuery({
    queryKey: ["proposal", daoId, proposalId],
    queryFn: async () => {
      const result = await Near.view(daoId, "get_proposal", {
        id: parseInt(proposalId),
      });
      return result;
    },
    enabled: !!daoId && proposalId !== null && proposalId !== undefined,
    staleTime: Infinity, // Never refetch automatically, only when invalidated
  });

  return {
    proposal: query.data || null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
