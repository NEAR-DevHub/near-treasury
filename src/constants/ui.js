export const TOOLTIP_TEXT = {
  LOCKUP_CONTRACT: {
    available:
      "Tokens that can be used immediately for payments, staking, or transferred out of the lockup account. This includes tokens that have vested, tokens earned as staking rewards, or any tokens transferred into the account. Tokens become available for payments through three primary mechanisms: vesting, withdrawals, and transfers. As tokens vest, they become available for payments. Additionally, staked tokens can be unstaked and withdrawn, but they will only be available for payments if they have also vested. Finally, any tokens transferred into the lockup account will be immediately available for payments.",
    staked:
      'Tokens that are currently staked with validators to earn staking rewards. You can unstake any amount of your staked tokens. However, only the portion of unstaked tokens that exceeds the current "Unvested" amount will become available for payments. Unstaking initiates a 48-hour waiting period. After that period, you must manually withdraw the unstaked tokens to make them available for payment.',
    pendingRelease:
      "Tokens that have been unstaked and are now within a 48-hour waiting period before they become available for withdrawal.",
    availableForWithdraw:
      'Tokens that have been unstaked and finished the 48-hour waiting period. Upon withdrawal, the portion of unstaked tokens that exceeds the current "Unvested" amount will become available for payments. The portion that is part of the "Unvested" amount will automatically return to Locked.',
    locked:
      "Tokens that are currently restricted by the vesting schedule and cannot be used for payments until they become vested. These tokens can only be staked.",
    reservedForStorage:
      "A small amount of tokens required to maintain this account active and cover the storage costs.",
  },
  DAO_ACCOUNT: {
    available: "Spendable now. Use these tokens for payments or staking.",
    staked:
      "Earning rewards with validators. To spend these tokens, unstake them first. This takes 52-65 hours.",
    pendingRelease:
      "Unstaking tokens … These tokens are ready to withdraw 52 to 65 hours after unstaking.",
    availableForWithdraw:
      "Unstaked tokens. Withdraw these tokens to make them spendable.",
    locked:
      "This is your locked NEAR balance. Until it vests, staking is the only way to use it.",
    reservedForStorage:
      "Keeps your account active. This small amount of NEAR covers storage costs.",
    readyToStake: "Available to stake. Earn rewards by staking these tokens",
  },
};

export const LOCKUP_TOOLTIP_TEXT = {
  startDate: "The date when the vesting period for this lockup account began.",
  endDate: "The date when the vesting period for this lockup account will end.",
  cliffDate:
    "The first date when a portion of the original allocated amount becomes vested according to the vesting schedule. At the cliff date, tokens may unlock all at once or gradually over time. Before the cliff date, you can stake these tokens, but you are unable to use them for any other payments.",
  originalAllocated:
    "The total amount of tokens initially allocated to this lockup account.",
  vested:
    "The portion of the original allocated amount that has become available for payments use according to the vesting schedule. This amount may or may not have already been used.",
  unvested:
    "The portion of the original allocated amount that is still locked and will become available gradually according to the vesting schedule. You can stake these tokens and are entitled to receive them in the future. Tokens automatically move from 'Unvested' to 'Vested' over time according to the vesting schedule.",
};

export const REFRESH_DELAY = 2000;
