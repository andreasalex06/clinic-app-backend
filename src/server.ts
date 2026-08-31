import { app } from "./app";
import { env } from "./config/env";
import { createServer } from "http";
import { registerSocketServer } from "./socket";

const server = createServer(app);

registerSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`Clinic API running on http://localhost:${env.PORT}`);
});
