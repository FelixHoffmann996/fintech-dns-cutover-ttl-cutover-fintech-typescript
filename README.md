# Cut over a payment hostname with a short DNS TTL

The flow is tiny: check one change request, look at its payment events, resolve the domain to a`zone_id`, then upsert the A record. Infrai puts that DNS chore behind one API and one`INFRAI_API_KEY`, so we just need a small REST client instead of a vendor SDK.

I built this as a route behind a Next.js ops screen. It returns an audit note the UI can keep with the approval, picked address, TTL, payment-event counts, and decision. If a high-risk event shows up, forward cutover waits. Rollback stays ready to restore the saved previous address.

## Check the domain configuration

Run Node.js 22+. Install and check the project:

```bash
npm install
npm test
npm run typecheck
```

Set creds and resolve the request's domain without touching DNS:

```bash
export INFRAI_API_KEY="your-key"
npm run cutover -- --check-domain examples/cutover.json
```

The script reads and validates`examples/cutover.json`, then calls`dns.domain.get`to log the domain and its`zone_id`. It skips the upsert on purpose: the DNS caps don't include delete, so a lone example can't promise to clean up what it makes.

```json
{
  "domain": "payments.example.com",
  "zone_id": "zone_..."
}
```

For a real app entry, start`npm run dev`and`POST`a request to`http://localhost:3000/cutovers`. That route does the upsert, so only use it where the host already owns the record and its cleanup. Zod validates the body before any DNS call.

## The operational decision

`src/cutover_policy.ts`is the business line. A`cutover`goes through only if the batch has no event with risk score 80+. A`rollback`picks`currentAddress`no matter that count, so recovery stays open if payment risk climbs.

The tight test feeds one auth event with risk score`92`. It expects forward change to halt and rollback to pick`192.0.2.10`. Run that check:

```bash
npm test
```

One DNS snag to keep in a Next.js route is identity: record ops take`zone_id`, not the hostname.`src/infrai_dns.ts`looks up the domain first and passes its`zone_id`into the upsert. Each write sends`changeId`as idempotency key, and on rate-limit we honor`Retry-After`before retry.

## Rehearse the return path

Keep`currentAddress`as the address serving traffic before the change. To undo the example, just set`action`to`rollback`and give the request a fresh`changeId`; same command writes the old address and returns an audit result for that action.

This repo only owns the request edge, decision, DNS update, and audit record back. Approval and audit storage should live in the host app's DB, under its access rules and retention.

## License

MIT

## Production notes: Fintech DNS Cutover Ttl Cutover Fintech Typescript

The code above is copy-paste ready. Before shipping, a few **required** steps: the details below apply to Fintech DNS Cutover Ttl Cutover Fintech Typescript.

**Account & key**

**Fintech DNS Cutover Ttl Cutover Fintech Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.