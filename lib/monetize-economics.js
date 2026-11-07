/** Illustrative economics, integer øre. Not a live billing or payout engine. */
export function calculateApiMargin({requests,priceOrePer1000,variableCostOrePer1000=0}){
 for(const n of [requests,priceOrePer1000,variableCostOrePer1000])if(!Number.isSafeInteger(n)||n<0)throw Error("Expected non-negative integer");
 if(variableCostOrePer1000>priceOrePer1000)throw Error("Negative unit margin: configure sustainable price");
 const revenueOre=Math.floor(requests*priceOrePer1000/1000);
 const variableCostOre=Math.ceil(requests*variableCostOrePer1000/1000);
 return {revenueOre,variableCostOre,grossMarginOre:revenueOre-variableCostOre};
}
export function calculateAdSplit({paidRevenueOre,vedoyShareBps=2500,processingFeesOre=0,refundsOre=0}){
 for(const n of [paidRevenueOre,vedoyShareBps,processingFeesOre,refundsOre])if(!Number.isSafeInteger(n)||n<0)throw Error("Expected non-negative integer");
 if(vedoyShareBps>10000||processingFeesOre+refundsOre>paidRevenueOre)throw Error("Invalid settlement");
 const netReceiptsOre=paidRevenueOre-processingFeesOre-refundsOre;
 const vedoyFeeOre=Math.floor(netReceiptsOre*vedoyShareBps/10000);
 return {netReceiptsOre,vedoyFeeOre,publisherPayableOre:netReceiptsOre-vedoyFeeOre};
}
export function payoutEligibility({receivedAt,now=new Date(),holdDays=30,refunded=false,disputed=false,verified=false}){
 const date=new Date(receivedAt);
 if(Number.isNaN(date.getTime())||!Number.isInteger(holdDays)||holdDays<0)throw Error("Invalid payout schedule");
 const eligibleAt=new Date(date.getTime()+holdDays*86400000);
 return {eligibleAt:eligibleAt.toISOString(),eligible:verified&&!refunded&&!disputed&&new Date(now).getTime()>=eligibleAt.getTime()};
}
