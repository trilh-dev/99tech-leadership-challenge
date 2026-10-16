import BigNumber from 'bignumber.js';

BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

export function dec(value: string | number | BigNumber): BigNumber {
  const bn = new BigNumber(value);
  if (!bn.isFinite()) throw new Error(`Invalid money value: ${value}`);
  return bn;
}

export const ZERO = dec(0);
