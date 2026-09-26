# Local development (no cloud account)

Everything runs locally against the Firebase **emulators**. You need Node 22, pnpm, Java 17+ (for the Firestore emulator) and a Gemini API key in the repo-root `.env` for the AI parts (`GEMINI_API_KEY=...`).

No service-account key is used or needed. The gateway, worker and scripts detect `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` and skip real credentials.

## 1. Emulators

```bash
# Firestore (port 8085). Launch the jar directly: it is downloaded to ~/.cache/firebase/emulators
# the first time you run any `firebase emulators:start`.
java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar --host=127.0.0.1 --port=8085 --rules=firestore.rules

# Auth (port 9099). firebase-tools 13.x supports Java 17; newer releases need Java 21.
npx firebase-tools@13.35.1 emulators:start --only auth --project pramaan-a0c00
```

## 2. Services

Use these environment variables for every process below:

```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=pramaan-a0c00
```

```bash
# worker
cd apps/worker-ai-pipeline && PORT=8081 WORKER_SHARED_SECRET=localsecret ./node_modules/.bin/tsx src/index.ts
# gateway
cd apps/api-gateway && PORT=8080 WORKER_URL=http://localhost:8081 WORKER_SHARED_SECRET=localsecret WEBHOOK_SHARED_SECRET=localsecret ./node_modules/.bin/tsx src/index.ts
# web (dev server)
cd apps/web && VITE_API_BASE_URL=http://localhost:8080/v1 VITE_FIREBASE_API_KEY=fake VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 ./node_modules/.bin/vite --port 5173 --strictPort
```

Use `--strictPort`: if another Vite is already on 5173, an implicit fallback to 5174 leaves your browser talking to the wrong configuration.

## 3. Seed data

From `scripts/`, with the emulator variables set plus `WORKER_URL=http://127.0.0.1:8081 WORKER_SHARED_SECRET=localsecret`:

```bash
./node_modules/.bin/tsx seed-demo-data/seedFirestoreReference.ts   # 36 states/UTs, ~35 districts, Brazil
./node_modules/.bin/tsx seed-demo-data/seedDemoData.ts             # ~430 issues, scored by the real worker
```

`seedDemoData.ts` is idempotent (every document id is prefixed `dm_`, and it cleans its previous run first) and prints the demo logins.

To regenerate the reference geography or the multilingual demo phrasings: `build-india-reference.ts`, `translate-demo-content.ts` (needs `GEMINI_API_KEY`).

## 4. Verify

```bash
./node_modules/.bin/tsx smoke-emulator.ts     # 42 end-to-end checks with real Gemini
```

## Translations

`node scripts/i18n-check.mjs` lists UI strings missing from `en.json`. Add English text, run `node scripts/i18n-merge.mjs additions.json`, then `tsx scripts/translate-i18n.ts` (Gemini; rejects any translation that changes a `{placeholder}`) to fill the ten other languages.

## Windows notes

- `pnpm exec tsx <args>` can hang when an argument looks like an email address; call `./node_modules/.bin/tsx` directly.
- If Firestore's own spawn exits with code `3221225786`, launch the jar directly as above.
