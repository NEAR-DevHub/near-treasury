"use client";

import { useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposal } from "@/hooks/useProposal";
import { decodeBase64, decodeProposalDescription } from "@/helpers/daoHelpers";
import {
  fetchBlockchainByNetwork,
  fetchTokenMetadataByDefuseAssetId,
} from "@/api/backend";
import { fetchWithdrawalStatus } from "@/api/chaindefuser";
import {
  isBulkPaymentApproveProposal,
  isBuyStorageProposal,
  calculateStorageCost,
  getPaymentList,
} from "@/api/bulk-payment";
import Big from "big.js";
import ProposalDetails from "@/components/proposals/ProposalDetails";
import VoteActions from "@/components/proposals/VoteActions";
import Profile from "@/components/ui/Profile";
import Copy from "@/components/ui/Copy";
import TokenAmount from "@/components/proposals/TokenAmount";
import TableSkeleton from "@/components/ui/TableSkeleton";

const ProposalDetailsPage = ({ id, isCompactVersion, onClose, currentTab }) => {
  const { accountId } = useNearWallet();
  const {
    daoId: treasuryDaoID,
    daoPolicy,
    getApproversAndThreshold,
  } = useDao();

  const { proposal: rawProposal, isError: isDeleted } = useProposal(id);

  // Check if this is a bulk payment proposal to conditionally fetch storage proposal
  const isBulkPayment = rawProposal
    ? isBulkPaymentApproveProposal(rawProposal)
    : false;

  // Only fetch potential linked storage proposal if this is a bulk payment
  const { proposal: potentialStorageProposal } = useProposal(
    isBulkPayment && id > 0 ? id - 1 : null
  );

  const [proposalData, setProposalData] = useState(null);
  const [linkedStorageProposal, setLinkedStorageProposal] = useState(null);
  const [paymentList, setPaymentList] = useState(null);
  const [isLoadingPaymentList, setIsLoadingPaymentList] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({
    blockchain: null,
    blockchainIcon: null,
  });
  const [transactionInfo, setTransactionInfo] = useState({
    nearTxHash: null,
    targetTxHash: null,
  });
  const [estimatedFee, setEstimatedFee] = useState(null);

  const transferApproversGroup = getApproversAndThreshold("transfer");

  const deleteGroup = getApproversAndThreshold("transfer", true);

  const hasVotingPermission = (
    transferApproversGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  const proposalPeriod = daoPolicy?.proposal_period || 0;

  // Clear proposal data when ID changes to show loader
  useEffect(() => {
    setProposalData(null);
    setLinkedStorageProposal(null);
    setPaymentList(null);
    setNetworkInfo({
      blockchain: null,
      blockchainIcon: null,
    });
    setTransactionInfo({
      nearTxHash: null,
      targetTxHash: null,
    });
    setEstimatedFee(null);
  }, [id]);

  // Check if there's a linked storage proposal for bulk payments
  useEffect(() => {
    if (
      isBulkPayment &&
      potentialStorageProposal &&
      isBuyStorageProposal(potentialStorageProposal)
    ) {
      setLinkedStorageProposal(potentialStorageProposal);
    } else {
      setLinkedStorageProposal(null);
    }
  }, [isBulkPayment, potentialStorageProposal]);

  // Fetch payment list for bulk payments in expanded view
  useEffect(() => {
    const fetchPaymentList = async () => {
      if (!isCompactVersion && proposalData?.bulkPaymentInfo?.listId) {
        setIsLoadingPaymentList(true);
        try {
          const result = await getPaymentList(
            proposalData.bulkPaymentInfo.listId
          );
          if (result && result.payments) {
            setPaymentList(result.payments);
          } else {
            setPaymentList(null);
          }
        } catch (error) {
          console.error("Error fetching payment list:", error);
          setPaymentList(null);
        } finally {
          setIsLoadingPaymentList(false);
        }
      }
    };

    fetchPaymentList();
  }, [isCompactVersion, proposalData?.bulkPaymentInfo?.listId]);

  // Process raw proposal data when it changes
  useEffect(() => {
    const processProposalData = async () => {
      if (!rawProposal || !proposalPeriod) return;

      try {
        const item = rawProposal;

        const notes = decodeProposalDescription("notes", item.description);
        const title = decodeProposalDescription("title", item.description);
        const summary = decodeProposalDescription("summary", item.description);
        const description = !title && !summary && item.description;
        const proposalIdStr = decodeProposalDescription(
          "proposalId",
          item.description
        );
        const proposalId = proposalIdStr ? parseInt(proposalIdStr, 10) : null;
        let proposalUrl = decodeProposalDescription("url", item.description);
        proposalUrl = (proposalUrl || "").replace(/\.+$/, "");

        const isFunctionType =
          Object.values(item?.kind?.FunctionCall ?? {})?.length > 0;
        let decodedArgs = {};

        // Check if this is a NEAR Intents payment request
        const isIntentsPayment =
          isFunctionType &&
          item.kind.FunctionCall?.receiver_id === "intents.near" &&
          item.kind.FunctionCall?.actions[0]?.method_name === "ft_withdraw";

        let args;
        let intentsTokenInfo = null;

        if (isIntentsPayment) {
          decodedArgs = decodeBase64(item.kind.FunctionCall?.actions[0].args);
          // For intents payments, extract the real token and recipient info
          let realRecipient;

          // Check if this is a cross-chain withdrawal (memo contains WITHDRAW_TO:)
          if (
            decodedArgs?.memo &&
            typeof decodedArgs.memo === "string" &&
            decodedArgs.memo.includes("WITHDRAW_TO:")
          ) {
            // Cross-chain intents payment - extract address from memo
            realRecipient = decodedArgs.memo.split("WITHDRAW_TO:")[1];
          } else {
            // NEAR intents payment - use receiver_id
            realRecipient = decodedArgs?.receiver_id;
          }

          intentsTokenInfo = {
            tokenContract: decodedArgs?.token,
            realRecipient: realRecipient,
            amount: decodedArgs?.amount,
            fee: decodedArgs?.fee,
            memo: decodedArgs?.memo,
            originalArgs: decodedArgs,
          };

          args = {
            token_id: decodedArgs?.token, // Use the actual token contract
            receiver_id: realRecipient, // Use the real recipient
            amount: decodedArgs?.amount,
          };
        } else if (isFunctionType) {
          const actions = item.kind.FunctionCall?.actions || [];
          const receiverId = item.kind.FunctionCall?.receiver_id;

          // Requests from NEARN
          if (
            actions.length >= 2 &&
            actions[0]?.method_name === "storage_deposit" &&
            actions[1]?.method_name === "ft_transfer"
          ) {
            args = {
              ...decodeBase64(actions[1].args),
              token_id: receiverId,
            };
          } else if (actions[0]?.method_name === "ft_transfer") {
            args = {
              ...decodeBase64(actions[0].args),
              token_id: receiverId,
            };
          } else {
            args = decodeBase64(actions[0]?.args);
          }
        } else {
          args = item.kind.Transfer;
        }

        let status = item.status;
        if (status === "InProgress") {
          const endTime = Big(item.submission_time ?? "0")
            .plus(proposalPeriod ?? "0")
            .toFixed();
          const timestampInMilliseconds = Big(endTime).div(Big(1_000_000));
          const currentTimeInMilliseconds = Date.now();
          if (Big(timestampInMilliseconds).lt(currentTimeInMilliseconds)) {
            status = "Expired";
          }
        }
        const sourceWallet = isIntentsPayment
          ? "Intents"
          : isFunctionType &&
              item.kind.FunctionCall?.actions[0]?.method_name === "transfer"
            ? "Lockup"
            : "SputnikDAO";

        // Check if this is a bulk payment proposal and extract info
        let bulkPaymentInfo = null;

        if (isBulkPaymentApproveProposal(item)) {
          // Extract bulk payment info from description
          const recipients = decodeProposalDescription(
            "recipients",
            item.description
          );
          const contract = decodeProposalDescription(
            "contract",
            item.description
          );
          const amount = decodeProposalDescription("amount", item.description);
          const listId = decodeProposalDescription("list_id", item.description);

          // Calculate storage fee based on recipient count
          const recipientCount = recipients ? parseInt(recipients, 10) : 0;
          const storageFee = calculateStorageCost(recipientCount);

          bulkPaymentInfo = {
            recipientCount,
            contract: contract || "",
            totalAmount: amount || "0",
            storageFee,
            listId: listId || null,
          };
        }

        setProposalData({
          id: item.id,
          proposer: item.proposer,
          votes: item.votes,
          submissionTime: item.submission_time,
          notes,
          title: title ? title : description,
          summary,
          proposalId,
          args,
          status,
          isLockupTransfer:
            isFunctionType &&
            item.kind.FunctionCall?.actions[0]?.method_name === "transfer",
          isIntentsPayment,
          intentsTokenInfo,
          proposalUrl,
          proposal: item,
          sourceWallet,
          bulkPaymentInfo,
        });
      } catch (e) {
        console.error("Error processing proposal data:", e);
      }
    };

    processProposalData();
  }, [rawProposal, proposalPeriod]);

  // Fetch network information for intents payments
  useEffect(() => {
    const fetchNetworkInfo = async () => {
      if (
        proposalData?.isIntentsPayment &&
        proposalData?.intentsTokenInfo?.tokenContract
      ) {
        const address = proposalData.intentsTokenInfo.tokenContract;

        try {
          // Call bridge RPC directly to get complete token metadata including withdrawal_fee
          const response = await fetch("https://bridge.chaindefuser.com/rpc", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: "supportedTokensFetchAll",
              jsonrpc: "2.0",
              method: "supported_tokens",
              params: [{}],
            }),
          });

          const bridgeData = await response.json();
          const intentsToken = bridgeData.result?.tokens?.find(
            (token) => token.near_token_id === address
          );

          if (intentsToken) {
            const defuse_asset_identifier_parts =
              intentsToken.defuse_asset_identifier?.split(":");
            const blockchain = defuse_asset_identifier_parts
              ? `${defuse_asset_identifier_parts[0]}:${defuse_asset_identifier_parts[1]}`
              : null;

            setNetworkInfo((prev) => ({
              ...prev,
              blockchain,
              symbol: intentsToken.asset_name || intentsToken.symbol,
            }));

            // Fetch blockchain name and icon using the intents_token_id
            // The backend API needs the chainName (e.g., "base", "arbitrum"), not the chain ID format
            if (intentsToken.intents_token_id) {
              try {
                const tokenMetadata = await fetchTokenMetadataByDefuseAssetId(
                  intentsToken.intents_token_id
                );

                // tokenMetadata is an array, get the first result
                const metadata =
                  Array.isArray(tokenMetadata) && tokenMetadata.length > 0
                    ? tokenMetadata[0]
                    : tokenMetadata;

                if (metadata && metadata.chainName) {
                  const networkResults = await fetchBlockchainByNetwork(
                    [metadata.chainName],
                    "light" // TODO: Use theme context when available
                  );
                  const networkData = Array.isArray(networkResults)
                    ? networkResults[0]
                    : networkResults;

                  if (networkData && networkData.error) {
                    console.error("Backend API error:", networkData.error);
                  } else if (networkData && networkData.name) {
                    setNetworkInfo((prev) => ({
                      ...prev,
                      name: networkData.name,
                      blockchainIcon: networkData.icon,
                    }));
                  }
                }
              } catch (error) {
                console.error("Failed to fetch blockchain metadata:", error);
              }
            }

            // Extract withdrawal fee information
            if (intentsToken.withdrawal_fee && intentsToken.decimals) {
              const feeAmount =
                parseFloat(intentsToken.withdrawal_fee) /
                Math.pow(10, intentsToken.decimals);
              const tokenSymbol =
                intentsToken.asset_name ||
                intentsToken.symbol ||
                intentsToken.blockchain?.toUpperCase() ||
                "tokens";

              console.log(`Withdrawal fee: ${feeAmount} ${tokenSymbol}`);

              setEstimatedFee({
                amount: feeAmount,
                symbol: tokenSymbol,
                isZero: feeAmount === 0,
              });
            } else {
              setEstimatedFee(null);
            }
          } else {
            // Clear fee info if token not found
            setEstimatedFee(null);
          }
        } catch (error) {
          console.error("Failed to fetch network info:", error);
        }
      }
    };

    fetchNetworkInfo();
  }, [
    proposalData?.isIntentsPayment,
    proposalData?.intentsTokenInfo?.tokenContract,
  ]);

  // Clear target chain transaction info and fee info for non-intents proposals or NEAR blockchain
  useEffect(() => {
    if (!proposalData?.isIntentsPayment || networkInfo.blockchain === "near") {
      setTransactionInfo((prev) => ({
        ...prev,
        targetTxHash: null,
      }));

      // Clear fee info for non-intents payments or NEAR payments (no withdrawal fee)
      if (
        !proposalData?.isIntentsPayment ||
        networkInfo.blockchain === "near"
      ) {
        setEstimatedFee(null);
      }
    }
  }, [proposalData?.isIntentsPayment, networkInfo.blockchain]);

  // Fetch target chain transaction hash for approved intents payments
  useEffect(() => {
    const fetchTargetChainTx = async () => {
      if (
        proposalData?.isIntentsPayment &&
        (proposalData?.status === "Approved" ||
          proposalData?.status === "Failed") &&
        networkInfo.blockchain &&
        networkInfo.blockchain !== "near" &&
        transactionInfo.nearTxHash &&
        transactionInfo.nearTxHash.includes("/txns/")
      ) {
        // Extract the transaction hash from the URL
        const nearTxHash = transactionInfo.nearTxHash.split("/txns/")[1];

        console.log(`Fetching withdrawal status for NEAR tx: ${nearTxHash}`);

        try {
          const result = await fetchWithdrawalStatus(nearTxHash);

          if (
            result &&
            result.status === "COMPLETED" &&
            result.data?.transfer_tx_hash
          ) {
            console.log(
              `Found target chain tx: ${result.data.transfer_tx_hash}`
            );

            // Create target chain explorer link
            let targetExplorerLink = null;
            if (result.data.chain && result.data.transfer_tx_hash) {
              const chainInfo = result.data.chain.toLowerCase();
              if (chainInfo.includes("eth")) {
                targetExplorerLink = `https://etherscan.io/tx/${result.data.transfer_tx_hash}`;
              } else if (chainInfo.includes("polygon")) {
                targetExplorerLink = `https://polygonscan.com/tx/${result.data.transfer_tx_hash}`;
              } else if (chainInfo.includes("bsc")) {
                targetExplorerLink = `https://bscscan.com/tx/${result.data.transfer_tx_hash}`;
              }
              // Add more chains as needed
            }

            if (targetExplorerLink) {
              setTransactionInfo((prev) => ({
                ...prev,
                targetTxHash: targetExplorerLink,
              }));
            }
          } else {
            console.log(`Withdrawal status: ${result?.status || "unknown"}`);
          }
        } catch (error) {
          console.error("Error fetching withdrawal status:", error);
        }
      }
    };

    fetchTargetChainTx();
  }, [
    proposalData?.isIntentsPayment,
    proposalData?.status,
    transactionInfo.nearTxHash,
    networkInfo.blockchain,
  ]);

  // Fetch execution transaction hash for approved proposals
  useEffect(() => {
    const fetchExecutionTx = async () => {
      if (
        (proposalData?.status === "Approved" ||
          proposalData?.status === "Failed") &&
        proposalData?.submissionTime &&
        proposalPeriod
      ) {
        const findExecutionTransaction = async () => {
          // Calculate the proposal timeframe using the actual proposal timestamps
          const submissionTimestamp = parseInt(proposalData.submissionTime);
          const expirationTimestamp =
            submissionTimestamp + parseInt(proposalPeriod);

          // Convert nanoseconds to milliseconds and create UTC dates
          const submissionDate = new Date(submissionTimestamp / 1000000);
          const expirationDate = new Date(expirationTimestamp / 1000000);

          // Format dates for the API (YYYY-MM-DD) in UTC
          // Note: after_date is exclusive, so we use the day before submission
          const afterDate = new Date(
            submissionDate.getTime() - 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split("T")[0];
          const beforeDate = new Date(
            expirationDate.getTime() + 7 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split("T")[0]; // Add 7 days buffer

          console.log(
            `Searching for proposal ${proposalData.id} execution between ${afterDate} and ${beforeDate}`
          );

          try {
            // Query NearBlocks API for on_proposal_callback transactions
            const response = await fetch(
              `https://api.nearblocks.io/v1/account/${treasuryDaoID}/receipts?method=on_proposal_callback&after_date=${afterDate}&before_date=${beforeDate}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_NEARBLOCKS_KEY}`,
                },
              }
            );

            if (!response.ok) {
              console.log("No execution transactions found or API error");
              return;
            }

            const data = await response.json();
            if (!data?.txns) {
              console.log("No execution transactions found");
              return;
            }

            console.log(
              `Found ${data.txns.length} on_proposal_callback transactions`
            );

            // Find the transaction that matches our proposal ID
            const matchingTxn = data.txns.find((txn) => {
              try {
                const args = JSON.parse(txn.actions[0]?.args || "{}");
                return args.proposal_id === proposalData.id;
              } catch (e) {
                return false;
              }
            });

            if (matchingTxn) {
              console.log(
                `Found execution transaction: ${matchingTxn.transaction_hash}`
              );
              setTransactionInfo((prev) => ({
                ...prev,
                nearTxHash: `https://nearblocks.io/txns/${matchingTxn.transaction_hash}`,
              }));
            } else {
              console.log(
                `No execution transaction found for proposal ${proposalData.id}`
              );
            }
          } catch (error) {
            console.error("Error fetching execution transaction:", error);
          }
        };

        findExecutionTransaction();
      }
    };

    fetchExecutionTx();
  }, [
    proposalData?.status,
    proposalData?.submissionTime,
    proposalData?.id,
    proposalPeriod,
    treasuryDaoID,
  ]);

  function getExplorerButtonText(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const actionText = url.includes("/tx/")
        ? "View transfer"
        : "View address";
      return `${actionText} on ${hostname}`;
    } catch (e) {
      // Fallback if URL parsing fails
      const actionText = url.includes("/tx/")
        ? "View transfer"
        : "View address";
      return `${actionText} on target explorer`;
    }
  }

  return (
    <ProposalDetails
      proposalData={proposalData}
      isDeleted={isDeleted}
      currentTab={currentTab}
      proposalPeriod={proposalPeriod}
      page="payments"
      isCompactVersion={isCompactVersion}
      onClose={onClose}
      approversGroup={transferApproversGroup}
      proposalStatusLabel={{
        approved: "Payment Request Approved",
        rejected: "Payment Request Rejected",
        deleted: "Payment Request Deleted",
        failed: "Payment Request Failed",
        expired: "Payment Request Expired",
      }}
      VoteActions={
        (hasVotingPermission || hasDeletePermission) &&
        proposalData?.status === "InProgress" ? (
          <VoteActions
            votes={proposalData?.votes}
            proposalId={proposalData?.id}
            hasDeletePermission={hasDeletePermission}
            hasVotingPermission={hasVotingPermission}
            proposalCreator={proposalData?.proposer}
            isIntentsRequest={proposalData?.isIntentsPayment}
            currentAmount={
              proposalData?.bulkPaymentInfo?.totalAmount ||
              proposalData?.args?.amount
            }
            currentContract={
              proposalData?.bulkPaymentInfo?.contract ||
              proposalData?.args?.token_id
            }
            isProposalDetailsPage={true}
            proposal={proposalData?.proposal}
            context="payment"
            linkedStorageProposal={linkedStorageProposal}
            bulkPaymentListId={proposalData?.bulkPaymentInfo?.listId}
          />
        ) : null
      }
      ProposalContent={
        proposalData?.bulkPaymentInfo ? (
          // Bulk Payment Content
          <div className="card card-body d-flex flex-column gap-2">
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="proposal-label">Source Wallet</label>
              <div className="h6 mb-0">{proposalData?.sourceWallet}</div>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Total Amount</label>
              <TokenAmount
                amountWithoutDecimals={
                  proposalData?.bulkPaymentInfo?.totalAmount
                }
                showUSDValue={true}
                address={proposalData?.bulkPaymentInfo?.contract}
                isProposalDetails={true}
              />
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Storage Fee</label>
              <TokenAmount
                amountWithoutDecimals={
                  proposalData?.bulkPaymentInfo?.storageFee
                }
                showUSDValue={true}
                address=""
                isProposalDetails={true}
              />
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">
                Total Recipients
              </label>
              <div className="h6 mb-0">
                {proposalData?.bulkPaymentInfo?.recipientCount} Recipients
              </div>
            </div>
            {/* Recipients Table - only in expanded view */}
            {!isCompactVersion && (
              <div className="d-flex flex-column gap-2 mt-2 border-top">
                {isLoadingPaymentList ? (
                  <table
                    className="table table-sm mb-0 no-padding"
                    style={{ fontSize: 14 }}
                  >
                    <thead>
                      <tr className="text-secondary">
                        <td style={{ width: 40 }}>№</td>
                        <td>Recipient</td>
                        <td className="text-right">Funding Ask</td>
                      </tr>
                    </thead>
                    <tbody>
                      <TableSkeleton numberOfCols={3} numberOfRows={3} />
                    </tbody>
                  </table>
                ) : paymentList && paymentList.length > 0 ? (
                  <table
                    className="table table-sm mb-0 no-padding"
                    style={{ fontSize: 14 }}
                  >
                    <thead>
                      <tr className="text-secondary">
                        <td style={{ width: 40 }}>№</td>
                        <td>Recipient</td>
                        <td className="text-right">Funding Ask</td>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentList.map((payment, index) => (
                        <tr key={index}>
                          <td className="fw-semibold">{index + 1}</td>
                          <td>
                            <Profile
                              accountId={payment.recipient}
                              displayImage={true}
                              displayName={true}
                              profileClass="text-secondary text-sm"
                            />
                          </td>
                          <td className="text-right">
                            <TokenAmount
                              amountWithoutDecimals={payment.amount}
                              address={proposalData?.bulkPaymentInfo?.contract}
                              showUSDValue={true}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          // Regular Payment Content
          <div className="card card-body d-flex flex-column gap-2">
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="proposal-label">Source Wallet</label>
              <div className="h6 mb-0">{proposalData?.sourceWallet}</div>
            </div>
            <h6 className="mb-0 flex-1 border-top pt-3">
              {proposalData?.title}
            </h6>
            {proposalData?.summary && (
              <div className="text-secondary">{proposalData?.summary}</div>
            )}
            {proposalData?.proposalId && (
              <div>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={proposalData?.proposalUrl}
                >
                  <button
                    className="btn p-0 d-flex align-items-center gap-2 h-auto text-color"
                    style={{ fontSize: 14 }}
                  >
                    Open Proposal <i className="bi bi-box-arrow-up-right"></i>
                  </button>
                </a>
              </div>
            )}
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Recipient</label>
              <div className="d-flex justify-content-between gap-2 align-items-center flex-wrap">
                <Profile
                  accountId={proposalData?.args?.receiver_id}
                  displayImage={true}
                  displayName={true}
                  profileClass="text-secondary text-sm"
                />
                <Copy
                  label="Copy Address"
                  clipboardText={proposalData?.args?.receiver_id}
                  showLogo={true}
                  className="btn btn-outline-secondary d-flex gap-1 align-items-center"
                />
              </div>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Funding Ask</label>
              <TokenAmount
                amountWithoutDecimals={proposalData?.args?.amount}
                showUSDValue={false}
                address={
                  proposalData?.isIntentsPayment
                    ? proposalData?.intentsTokenInfo?.tokenContract
                    : proposalData?.args?.token_id
                }
                isProposalDetails={true}
              />
              {proposalData?.isIntentsPayment && networkInfo.blockchain && (
                <div className="d-flex flex-column gap-2 mt-3">
                  <label className="border-top proposal-label">Network</label>
                  <div className="d-flex gap-1 align-items-center">
                    {networkInfo.blockchainIcon && (
                      <img
                        src={networkInfo.blockchainIcon}
                        width="25"
                        height="25"
                        alt={networkInfo.blockchain}
                        className="rounded-circle object-fit-cover"
                      />
                    )}
                    <span
                      style={{ fontSize: "18px" }}
                      className="text-capitalize fw-semi-bold"
                    >
                      {networkInfo.name ?? networkInfo.blockchain}
                    </span>
                  </div>
                </div>
              )}
              {proposalData?.isIntentsPayment &&
                estimatedFee &&
                !estimatedFee.isZero && (
                  <div className="d-flex flex-column gap-2 mt-3">
                    <label className="border-top proposal-label">
                      Estimated Fee
                    </label>
                    <div className="d-flex flex-column gap-2">
                      <span style={{ fontSize: "16px" }}>
                        {estimatedFee.amount} {estimatedFee.symbol}
                      </span>
                      <small
                        className="text-secondary"
                        style={{ fontSize: "12px" }}
                      >
                        This is an estimated fee. Check the transaction links
                        below for the actual fee charged.
                      </small>
                    </div>
                  </div>
                )}
              {(proposalData?.status === "Approved" ||
                proposalData?.status === "Failed") &&
                transactionInfo.nearTxHash && (
                  <div className="d-flex flex-column gap-2 mt-1">
                    <label className="border-top proposal-label">
                      Transaction Links
                    </label>
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex justify-content-between gap-2 align-items-center flex-wrap">
                        <a
                          href={transactionInfo.nearTxHash}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="d-flex align-items-center gap-2 text-color text-underline"
                        >
                          View execution on nearblocks.io{" "}
                          <i className="bi bi-box-arrow-up-right"></i>
                        </a>
                      </div>
                      {transactionInfo.targetTxHash && (
                        <div className="d-flex justify-content-between gap-2 align-items-center flex-wrap">
                          <a
                            href={transactionInfo.targetTxHash}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="d-flex align-items-center gap-2 text-color text-underline"
                          >
                            {getExplorerButtonText(
                              transactionInfo.targetTxHash
                            )}{" "}
                            <i className="bi bi-box-arrow-up-right"></i>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )
      }
    />
  );
};

export default ProposalDetailsPage;
