/**
 * Raid auction (loot bidding) math. The winner pays their bid, split evenly
 * between the other N - 1 players. With P the market price and f the market
 * fee you'd pay to resell (5%, or 0 if you'll use the item yourself):
 *
 *   win at bid B:            you end up with P(1 - f) - B
 *   someone else wins at B:  you get B / (N - 1)
 *
 * Bidding is worth it until those are equal: B = P(1 - f)(N - 1) / N, the
 * break-even bid. The recommended bid leaves a margin, break-even / 1.1 (the
 * common community rule of thumb), so winning still beats not bidding.
 */

export const MARKET_FEE = 0.05;
export const PROFIT_MARGIN = 1.1;
export const PARTY_SIZES = [4, 8] as const;

export type Bid = { breakEven: number; recommended: number };

export function auctionBids(marketPrice: number, partySize: number, resell: boolean): Bid {
  if (!(marketPrice > 0) || partySize < 2) return { breakEven: 0, recommended: 0 };
  const value = marketPrice * (resell ? 1 - MARKET_FEE : 1);
  const breakEven = Math.floor((value * (partySize - 1)) / partySize);
  return { breakEven, recommended: Math.floor(breakEven / PROFIT_MARGIN) };
}

/** The formula with the numbers filled in, for the tooltip. */
export function auctionFormula(marketPrice: number, partySize: number, resell: boolean) {
  const fee = resell ? " × 0.95 (market fee)" : "";
  return `Break-even = ${marketPrice.toLocaleString()}${fee} × ${partySize - 1}/${partySize}. Recommended = break-even ÷ ${PROFIT_MARGIN}.`;
}
