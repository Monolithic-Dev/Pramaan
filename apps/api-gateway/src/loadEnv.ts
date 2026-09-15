// Side-effect-only module, imported first in index.ts so its effects land
// before app.js/deps.js (which read process.env at import time) evaluate.
// Loads the repo-root .env for local dev convenience — Cloud Run/CI inject
// real env vars directly, so this is a no-op there.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const rootEnvPath = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnvPath)) config({ path: rootEnvPath });
