/** Policy helpers only. No production wallet or payment gateway is activated. */
export const COIN_UNIT="VEDOY_COIN";
export const COIN_REDEMPTION={enabled:false,fiatCashout:false,thirdPartyTransfer:false};
export function validateCoinAmount(amount){if(!Number.isSafeInteger(amount)||amount<=0)throw new RangeError("Coin amount must be a positive safe integer");return amount;}
export function calculateCoinCheckout({priceOre,coinValueOre=100,balanceCoins,coinsToSpend}){
 for(const n of [priceOre,coinValueOre,balanceCoins,coinsToSpend])if(!Number.isSafeInteger(n)||n<0)throw new RangeError("Non-negative integer required");
 if(coinValueOre===0)throw new RangeError("Invalid conversion rate");
 if(coinsToSpend>balanceCoins)throw new RangeError("Insufficient coins");
 const coveredOre=Math.min(priceOre,coinsToSpend*coinValueOre);
 if(coinsToSpend*coinValueOre>priceOre)throw new RangeError("Overpayment in coins");
 return {coveredOre,remainingOre:priceOre-coveredOre,coinsToSpend};
}
export function canAwardCoins({verified,consent,duplicate,fraudFlag}){return verified===true&&consent===true&&duplicate!==true&&fraudFlag!==true;}
