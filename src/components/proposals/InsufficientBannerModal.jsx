"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useSocialAccount } from "@/context/SocialAccountContext";
import { getNearBalances } from "@/api/rpc";
import { formatNearAmount } from "@/helpers/nearHelpers";

const InsufficientBannerModal = ({
  ActionButton,
  checkForDeposit = false,
  callbackAction,
  disabled = false,
  className = "",
}) => {
  const { accountId } = useNearWallet();
  const { daoPolicy } = useDao();
  const { profile } = useSocialAccount();
  const [showModal, setShowModal] = useState(false);
  const [nearBalances, setNearBalances] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!accountId) {
        setLoading(false);
        return;
      }

      try {
        const balances = await getNearBalances(accountId);
        setNearBalances(balances);
      } catch (error) {
        console.error("Error fetching balances:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [accountId]);

  const name = profile?.name ?? accountId;
  const ADDITIONAL_AMOUNT = checkForDeposit
    ? parseFloat(formatNearAmount(daoPolicy?.proposal_bond || "0"))
    : 0;

  const INSUFFICIENT_BALANCE_LIMIT = ADDITIONAL_AMOUNT + 0.1; // 0.1N

  const checkBalance = (e) => {
    if (disabled || !accountId || loading) {
      return;
    }
    if (
      parseFloat(nearBalances?.availableParsed || "0") <
      INSUFFICIENT_BALANCE_LIMIT
    ) {
      setShowModal(true);
    } else {
      callbackAction?.(e);
    }
  };

  const WarningModal = () => (
    <Modal
      isOpen={showModal}
      heading={
        <div
          className="d-flex align-items-center gap-2"
          style={{ color: "var(--other-warning)" }}
        >
          <i className="bi bi-exclamation-octagon mb-0"></i>
          Insufficient Funds
        </div>
      }
      onClose={() => setShowModal(false)}
    >
      <div className="text-color">
        Hey {name}, you don't have enough NEAR to complete actions on your
        treasury. You need at least {INSUFFICIENT_BALANCE_LIMIT.toFixed(2)}N{" "}
        {checkForDeposit &&
          ", which includes the proposal bond needed to create a proposal"}
        . Please add more funds to your account and try again.
      </div>
    </Modal>
  );

  if (loading) {
    return (
      <div className={className}>
        <ActionButton />
      </div>
    );
  }

  return (
    <>
      <div className={className} onClick={checkBalance}>
        <ActionButton />
      </div>
      <WarningModal />
    </>
  );
};

export default InsufficientBannerModal;
