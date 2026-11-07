import test from "node:test";import assert from "node:assert/strict";
import {calculateCoinCheckout,canAwardCoins,COIN_REDEMPTION} from "../lib/coins-policy.js";
test("coins can cover whole checkout",()=>assert.deepEqual(calculateCoinCheckout({priceOre:2500,balanceCoins:40,coinsToSpend:25}),{coveredOre:2500,remainingOre:0,coinsToSpend:25}));
test("partial checkout keeps fiat remainder",()=>assert.equal(calculateCoinCheckout({priceOre:2500,balanceCoins:10,coinsToSpend:5}).remainingOre,2000));
test("reject overspending and negative amounts",()=>{assert.throws(()=>calculateCoinCheckout({priceOre:100,balanceCoins:1,coinsToSpend:2}));assert.throws(()=>calculateCoinCheckout({priceOre:-1,balanceCoins:1,coinsToSpend:1}));});
test("no unverified or nonconsensual rewards",()=>{assert.equal(canAwardCoins({verified:true,consent:true}),true);assert.equal(canAwardCoins({verified:false,consent:true}),false);assert.equal(canAwardCoins({verified:true,consent:false}),false);});
test("no cashout or transfers by default",()=>{assert.equal(COIN_REDEMPTION.fiatCashout,false);assert.equal(COIN_REDEMPTION.thirdPartyTransfer,false);});
