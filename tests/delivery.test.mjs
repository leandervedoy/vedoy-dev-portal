import test from "node:test";
import assert from "node:assert/strict";
import { deliveryProviders, requestWoltQuote, woltPromiseBody, woltQuoteReady } from "../lib/delivery.js";

test("all planned carriers are visible, but bookings are explicitly disabled", () => {
  const carriers = deliveryProviders({});
  assert.equal(carriers.length, 8);
  assert.deepEqual(carriers.map(item => item.id), [
    "wolt-drive", "bring", "helthjem", "postnord",
    "porterbuddy", "nshift", "foodora", "uber-direct"
  ]);
  assert.ok(carriers.every(item => item.bookingEnabled === false));
  assert.ok(carriers.every(item => item.coverageVerified === false));
  assert.equal(carriers.find(item => item.id === "foodora").kind, "partner_platform");
});

test("Wolt live quotes only enable with merchant credentials and explicit production opt-in", () => {
  assert.equal(woltQuoteReady({}), false);
  assert.equal(woltQuoteReady({ WOLT_DRIVE_API_KEY: "test", WOLT_DRIVE_VENUE_ID: "venue_123" }), true);
  assert.equal(woltQuoteReady({ WOLT_DRIVE_API_KEY: "test", WOLT_DRIVE_VENUE_ID: "venue_123", WOLT_DRIVE_ENV: "production" }), false);
  assert.equal(woltQuoteReady({ WOLT_DRIVE_API_KEY: "test", WOLT_DRIVE_VENUE_ID: "venue_123", WOLT_DRIVE_ENV: "production", WOLT_DRIVE_LIVE_QUOTES_ENABLED: "true" }), true);
});

test("Wolt quote validates destination and preparation time", () => {
  assert.throws(() => woltPromiseBody({dropoff:{city:"Haugesund"}}), /dropoff/);
  assert.throws(() => woltPromiseBody({dropoff:{street:"Kirkegata 4",city:"Haugesund"},preparationMinutes:61}), /preparationMinutes/);
  assert.deepEqual(woltPromiseBody({dropoff:{street:"Kirkegata 4",postCode:"5528",city:"Haugesund"},preparationMinutes:20}), {
    street:"Kirkegata 4", post_code:"5528", city:"Haugesund", min_preparation_time_minutes:20
  });
});

test("unconfigured provider fails closed without making upstream requests", async () => {
  let called=false;
  await assert.rejects(
    requestWoltQuote({dropoff:{street:"Kirkegata 4",city:"Haugesund"}}, {
      env:{}, fetcher: async()=>{ called=true; return {}; }
    }),
    error=>error.code==="delivery_provider_not_configured" && error.status===503
  );
  assert.equal(called,false);
});

test("Wolt quote response is normalized and cannot place a paid booking", async () => {
  const env={WOLT_DRIVE_API_KEY:"sandbox-test",WOLT_DRIVE_VENUE_ID:"venue_123"};
  let url,request;
  const quote=await requestWoltQuote({
    dropoff:{street:"Kirkegata 4",city:"Haugesund",postCode:"5528"}
  },{
    env,
    fetcher:async (u,r)=>{
      url=u;request=r;
      return {ok:true,json:async()=>({
        id:"promise1",is_binding:true,valid_until:"2026-11-05T15:00:00Z",
        price:{amount:7900,currency:"NOK"},dropoff:{eta_minutes:40}
      })};
    }
  });
  assert.match(url,/\/v1\/venues\/venue_123\/shipment-promises$/);
  assert.equal(request.method,"POST");
  assert.equal(request.headers.Authorization,"Bearer sandbox-test");
  assert.equal(quote.price.amount,7900);
  assert.equal(quote.price.amountFormat,"provider_native");
  assert.equal(quote.binding,true);
  assert.equal(quote.bookingEnabled,false);
});

test("upstream failures do not leak provider response text or credentials", async () => {
  await assert.rejects(
    requestWoltQuote({dropoff:{street:"Kirkegata 4",city:"Haugesund"}},{
      env:{WOLT_DRIVE_API_KEY:"secret",WOLT_DRIVE_VENUE_ID:"venue_123"},
      fetcher:async()=>({ok:false,status:401,text:async()=>"secret"})
    }),
    error=>error.code==="delivery_provider_rejected_quote"&&!error.message.includes("secret")
  );
});
