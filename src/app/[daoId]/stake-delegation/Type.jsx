"use client";

import StakeIcon from "@/components/icons/StakeIcon";
import UnstakeIcon from "@/components/icons/UnstakeIcon";
import WithdrawIcon from "@/components/icons/WithdrawIcon";
import WhitelistIcon from "@/components/icons/WhitelistIcon";

const Type = ({ type }) => {
  const classes =
    "d-flex gap-2 align-items-center justify-content-center border rounded-pill py-1 px-2";

  const Badge = () => {
    switch (type) {
      case "unstake": {
        return (
          <div className={classes}>
            <UnstakeIcon />
            Unstake
          </div>
        );
      }
      case "withdraw_all":
      case "withdraw_all_from_staking_pool": {
        return (
          <div className={classes}>
            <WithdrawIcon />
            Withdraw
          </div>
        );
      }
      case "select_staking_pool": {
        return (
          <div className={classes}>
            <WhitelistIcon />
            Whitelist
          </div>
        );
      }
      default: {
        return (
          <div className={classes}>
            <StakeIcon />
            Stake
          </div>
        );
      }
    }
  };

  return <Badge />;
};

export default Type;
