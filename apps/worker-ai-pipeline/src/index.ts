import "./loadEnv.js";
import { buildApp } from "./app.js";
import { createRealDeps } from "./deps.js";

const app = buildApp(createRealDeps());
const port = Number(process.env.PORT ?? 8081);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
