import { createServer } from "node:http";
import { ZodError } from "zod";
import { applyCutover } from "./cutover_service.js";
import { InfraiDnsClient, InfraiError } from "./infrai_dns.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const dns = new InfraiDnsClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/cutovers") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const audit = await applyCutover(body, dns);
    response.writeHead(audit.decision === "paused" ? 409 : 200);
    response.end(JSON.stringify(audit));
  } catch (error) {
    if (error instanceof ZodError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid request", issues: error.issues }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.code }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "Request could not be completed" }));
  }
});

server.listen(port, () => {
  console.log(`Cutover route listening on http://localhost:${port}/cutovers`);
});
