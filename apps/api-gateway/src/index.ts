import "./loadEnv.js";
import { buildApp } from "./app.js";
import { createRealDeps } from "./deps.js";

const app = buildApp(createRealDeps());
const port = Number(process.env.PORT ?? 8080);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// Cloud Run and Render send SIGTERM before stopping an instance: finish in-flight requests first.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  });
}
