export const CARD_CONDITIONS = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged"
] as const;

export type CardCondition = (typeof CARD_CONDITIONS)[number];