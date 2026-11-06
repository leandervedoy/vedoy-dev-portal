import test from "node:test";
import assert from "node:assert/strict";
import { API_MODULES, REWARDS_GAMES, findApiModule, isRewardGame } from "../lib/module-catalog.js";

test("App modules have unique keys, explicit tiers and consistent dependencies",()=>{
 const keys=API_MODULES.map(m=>m.key);
 assert.equal(new Set(keys).size,keys.length);
 assert.ok(API_MODULES.every(m=>["included","subscription"].includes(m.tier)));
 assert.ok(API_MODULES.every(m=>!m.requires||m.requires.every(key=>keys.includes(key))));
 assert.equal(findApiModule("highscores")?.tier,"subscription");
 assert.deepEqual(findApiModule("highscores").requires,["games"]);
 assert.equal(findApiModule("games")?.tier,"included");
 assert.equal(findApiModule("coins")?.installable,false);
});
test("Games represent legacy discovery and never claim production coins",()=>{
 assert.equal(REWARDS_GAMES.length,7);
 assert.equal(new Set(REWARDS_GAMES.map(g=>g.id)).size,REWARDS_GAMES.length);
 assert.ok(REWARDS_GAMES.every(g=>g.status==="legacy"));
 assert.equal(isRewardGame("snake"),true);
 assert.equal(isRewardGame("garbage"),false);
});
