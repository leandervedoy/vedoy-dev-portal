import test from "node:test";
import assert from "node:assert/strict";
import { catalogHandler } from "../lib/public-catalog.js";
function res() { const obj={statusCode:200, headers:{}, body:null}; obj.setHeader=(k,v)=>obj.headers[k]=v; obj.end=(s)=>obj.body=s;return obj; }
test("Only public GET queries allowed",async()=>{const r=res();await catalogHandler({method:"POST",url:"/api/v1/pricing"},r,"prices");assert.equal(r.statusCode,405);});
test("Invalid filters rejected before calling Supabase",async()=>{const r=res();await catalogHandler({method:"GET",url:"/api/v1/pricing?code=invalid%28input"},r,"prices");assert.equal(r.statusCode,400);});
test("Never pretend a failed backend query succeeded",async()=>{const existing=globalThis.fetch;globalThis.fetch=async()=>({ok:false,status:500});try{const r=res();await catalogHandler({method:"GET",url:"/api/v1/pricing"},r,"prices");assert.equal(r.statusCode,503)}finally{globalThis.fetch=existing;}});
test("Reads published prices and maps amounts in ore",async()=>{const existing=globalThis.fetch;globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.searchParams.get("published"),"eq.true");return {ok:true,json:async()=>[{code:"nettside-drift",category:"studio",title:"Nettside & Drift",amount_ore:49000,setup_ore:100000,billing_period:"month",features:[],currency:"NOK",vat_mode:"excl"}]};};try{const r=res();await catalogHandler({method:"GET",url:"/api/v1/pricing"},r,"prices");assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).prices[0].amountOre,49000)}finally{globalThis.fetch=existing;}});
