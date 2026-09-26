import "./loadEnv.js";
import { buildApp } from "./app.js";
import { createRealDeps } from "./deps.js";

const app = buildApp(createRealDeps());
const port = Number(process.env.PORT ?? 8081);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// Let an in-flight submission finish before the platform stops the instance; the sweep job
// requeues anything still stuck in "processing" if it does not.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  });
}
