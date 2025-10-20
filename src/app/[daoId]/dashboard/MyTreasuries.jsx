"use client";

import { useState, useEffect, useRef } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { getUserTreasuries } from "@/helpers/treasuryHelpers";

const MyTreasuries = () => {
  const { accountId } = useNearWallet();
  const { daoConfig } = useDao();
  const [currentTreasury, setCurrentTreasury] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userTreasuries, setUserTreasuries] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (accountId) {
      getUserTreasuries(accountId).then((results) => {
        setUserTreasuries(results);
      });
    }
  }, [accountId]);

  useEffect(() => {
    if (daoConfig) {
      setCurrentTreasury(daoConfig);
    }
  }, [daoConfig]);

  const defaultImage =
    "https://ipfs.near.social/ipfs/bafkreia5drpo7tfsd7maf4auxkhatp6273sunbg7fthx5mxmvb2mooc5zy";

  if (!currentTreasury) {
    return <></>;
  }

  const treasuryLogo = (currentTreasury.metadata?.flagLogo ?? "")?.includes(
    "ipfs"
  )
    ? currentTreasury?.metadata?.flagLogo
    : defaultImage;

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div
      ref={dropdownRef}
      className="position-relative"
      tabIndex="0"
      style={{ width: "fit-content" }}
      onBlur={() => {
        setTimeout(() => setIsOpen(false), 200);
      }}
    >
      {treasuryLogo && typeof treasuryLogo === "string" ? (
        <img
          src={treasuryLogo}
          width={50}
          height={50}
          className="rounded-3 object-fit-cover"
          alt="Treasury Logo"
        />
      ) : (
        treasuryLogo
      )}
      {Array.isArray(userTreasuries) && userTreasuries?.length > 0 && (
        <div className="navbar-my-treasuries-dropdown" onClick={toggleDropdown}>
          <i className="bi bi-chevron-down h6 mb-0"></i>
        </div>
      )}
      {isOpen && (
        <div
          className="dropdown-menu dropdown-menu-end dropdown-menu-lg-start shadow show p-2"
          style={{ width: "300px" }}
        >
          <div className="d-flex justify-content-between w-100 fw-semi-bold heading align-items-center mb-1">
            <div>My Treasuries</div>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://near.social/treasury-factory.near/widget/app?page=my-treasuries"
            >
              <div className="primary-text-color text-sm">Manage</div>
            </a>
          </div>
          <div className="scroll-box">
            {userTreasuries.map((option) => {
              return (
                <a
                  key={option.daoId}
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`/${option.daoId}/dashboard`}
                  className="dropdown-item cursor-pointer w-100 text-wrap d-flex gap-2 align-items-center"
                >
                  <img
                    src={
                      (option.config.metadata?.flagLogo ?? "")?.includes("ipfs")
                        ? option.config.metadata?.flagLogo
                        : defaultImage
                    }
                    width={32}
                    height={32}
                    className="rounded-3 object-fit-cover"
                    alt={option.config.name}
                  />
                  <div className="d-flex flex-column">
                    <div className="fw-semi-bold">{option.config.name}</div>
                    <div className="text-secondary text-sm">
                      @{option.daoId}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTreasuries;
