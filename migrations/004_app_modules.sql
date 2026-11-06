-- Per-project app module settings. The schema is private to the Developer Portal's PostgreSQL service.
CREATE TABLE IF NOT EXISTS developer_project_subscriptions (
 project_id uuid PRIMARY KEY REFERENCES developer_projects(id) ON DELETE CASCADE,
 provider text NOT NULL DEFAULT 'manual' CHECK(provider IN ('manual','stripe')),
 status text NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive','trialing','active','past_due','canceled')),
 valid_until timestamptz,
 provider_subscription_id text UNIQUE,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS developer_app_modules (
 project_id uuid NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
 module_key text NOT NULL CHECK(module_key IN ('games','highscores')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,module_key)
);
CREATE TABLE IF NOT EXISTS developer_app_games (
 project_id uuid NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
 game_key text NOT NULL CHECK(game_key IN ('chess','ttt','four','hangman','snake','sudoku','2048')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,game_key)
);
CREATE TABLE IF NOT EXISTS developer_app_highscores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
 game_key text NOT NULL,
 player_alias text NOT NULL CHECK(char_length(player_alias) BETWEEN 1 AND 36),
 score integer NOT NULL CHECK(score BETWEEN 0 AND 100000000),
 idempotency_key text NOT NULL CHECK(char_length(idempotency_key) BETWEEN 8 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,idempotency_key),
 FOREIGN KEY (project_id,game_key) REFERENCES developer_app_games(project_id,game_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS developer_app_highscores_top_idx ON developer_app_highscores(project_id,game_key,score DESC,created_at ASC);
COMMENT ON TABLE developer_app_highscores IS 'Beta: unverified developer submitted scores. Never awards Vedoy Coins.';
