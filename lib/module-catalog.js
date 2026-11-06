// Public metadata. Real authorization is enforced in the API and database.
export const API_MODULES = Object.freeze([
  { key: "games", title: "Game Library", icon: "🎮", tier: "included", availability: "catalog", installable: true, description: "Choose games for this app. Currently catalog metadata only; game engines remain in Collective during migration.", endpoints: ["GET /v1/rewards/games"] },
  { key: "highscores", title: "Highscore API", icon: "🏆", tier: "subscription", availability: "beta", installable: true, requires: ["games"], description: "Server-to-server, per-app score submission and leaderboard. Scores are unverified; no coins are awarded.", endpoints: ["GET /v1/rewards/highscores?game=snake", "POST /v1/rewards/highscores"] },
  { key: "quizzes", title: "Quiz & Surveys", icon: "🧠", tier: "subscription", availability: "planned", installable: false, description: "Opt-in questions, review and publisher reports. Not yet exposed as an API.", endpoints: [] },
  { key: "coins", title: "Vedoy Coins", icon: "🪙", tier: "subscription", availability: "planned", installable: false, description: "Server-verified rewards and a shared coin ledger. Distinct from Vedoy Credits.", endpoints: [] },
  { key: "statistics", title: "Statistics", icon: "📊", tier: "subscription", availability: "planned", installable: false, description: "Aggregate analytics and opt-in insights, subject to privacy controls.", endpoints: [] },
  { key: "phone", title: "Phone & Messaging", icon: "📞", tier: "subscription", availability: "existing-separate", installable: false, description: "Telnyx is the current live provider adapter. Twilio is being integrated separately; do not expose purchase or calling until billing, regulatory review and scoped permissions are complete.", endpoints: ["GET /v1/numbers/available", "POST /v1/messages"] },
  { key: "twilio", title: "Twilio Voice & Numbers", icon: "☎️", tier: "subscription", availability: "integration-preview", installable: false, description: "Twilio integration for Vedoy Phone: Norwegian-first number catalog, voice, regulatory onboarding and 20% gross-margin pricing. Configuration and provider adapter are pending; no live purchase access.", endpoints: ["GET /v1/providers/twilio/pricing?country=NO"] }
]);
export const REWARDS_GAMES = Object.freeze([
  { id:"chess", title:"Chess", icon:"♟️", status:"legacy", description:"Practice only; current rules do not enforce checkmate." },
  { id:"ttt", title:"Tic-Tac-Toe", icon:"❎", status:"legacy" },
  { id:"four", title:"Connect Four", icon:"🔴", status:"legacy" },
  { id:"hangman", title:"Word Guess", icon:"🔤", status:"legacy" },
  { id:"snake", title:"Snake", icon:"🐍", status:"legacy" },
  { id:"sudoku", title:"Sudoku Mini", icon:"🔢", status:"legacy" },
  { id:"2048", title:"2048", icon:"🧩", status:"legacy" }
]);
export function findApiModule(key) { return API_MODULES.find(item => item.key === key); }
export function isRewardGame(key) { return REWARDS_GAMES.some(item => item.id === key); }
