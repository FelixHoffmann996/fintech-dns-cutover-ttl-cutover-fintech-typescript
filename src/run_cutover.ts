import { readFile } from "node:fs/promises";
import { cutoverRequestSchema } from "./cutover_policy.js";
import { InfraiDnsClient } from "./infrai_dns.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running a cutover");

if (process.argv[2] !== "--check-domain") {
  throw new Error("Pass --check-domain and a JSON request file");
}

const inputPath = process.argv[3];
if (!inputPath) throw new Error("Pass a JSON request file after --check-domain");

const input = cutoverRequestSchema.parse(
  JSON.parse(await readFile(inputPath, "utf8"))
);
const zone_id = await new InfraiDnsClient(apiKey).getZoneId(input.domain);
console.log(JSON.stringify({ domain: input.domain, zone_id }, null, 2));
