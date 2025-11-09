import { useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Near } from "@/api/near";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";

// Determine context from URL pathname
const getContextFromPath = (pathname) => {
  if (!pathname) return null;

  // Match specific routes
  if (pathname.includes("/payments")) return "payment";
  if (pathname.includes("/stake-delegation")) return "stake";
  if (pathname.includes("/asset-exchange")) return "exchange";
  if (pathname.includes("/function-call")) return "function";
  if (pathname.includes("/settings")) return "settings";

  // Return null for unknown routes (no transaction handling)
  return null;
};

// Decode base64 string safely
const decodeBase64 = (str) => {
  try {
    // Use Buffer in Node.js environment or atob in browser
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "base64").toString("utf-8");
    }
    return globalThis.atob(str);
  } catch {
    return "";
  }
};

export const useTransactionHandler = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { accountId } = useNearWallet();
  const { daoId: treasuryDaoID } = useDao();
  const { showToast } = useProposalToastContext();

  useEffect(() => {
    const transactionHashes = searchParams.get("transactionHashes");
    const context = getContextFromPath(pathname);

    // Skip if no transaction, not logged in, not in a DAO, or unknown route
    if (!transactionHashes || !accountId || !treasuryDaoID || !context) return;

    fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "tx",
        params: [transactionHashes, accountId],
      }),
    })
      .then((response) => response.json())
      .then(async (transaction) => {
        if (transaction !== null) {
          const transaction_method_name =
            transaction?.result?.transaction?.actions[0]?.FunctionCall
              ?.method_name;

          if (transaction_method_name === "act_proposal") {
            const args =
              transaction?.result?.transaction?.actions[0]?.FunctionCall?.args;
            const decodedArgsStr = decodeBase64(args ?? "");
            const decodedArgs = decodedArgsStr
              ? JSON.parse(decodedArgsStr)
              : {};
            if (decodedArgs.id !== undefined) {
              const proposalId = decodedArgs.id;
              // Check proposal status
              try {
                const result = await Near.view(treasuryDaoID, "get_proposal", {
                  id: proposalId,
                });
                showToast(result.status, proposalId, context);
              } catch {
                // deleted request (thus proposal won't exist)
                showToast("Removed", proposalId, context);
              }
            }
          } else if (transaction_method_name === "add_proposal") {
            const proposalId = decodeBase64(
              transaction.result.status.SuccessValue
            );
            showToast("ProposalAdded", proposalId, context);
          }
        }
      })
      .catch((error) => {
        console.error("Error checking transaction:", error);
      });
  }, [searchParams, accountId, treasuryDaoID, showToast, pathname]);
};
