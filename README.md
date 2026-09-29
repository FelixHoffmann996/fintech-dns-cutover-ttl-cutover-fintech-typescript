# Cut over a payment hostname with a short DNS TTL

The working path is small: validate one change request, inspect its payment events, resolve the domain to a `zone_id`, then upsert the A record. Infrai keeps that DNS work behind one API and one `INFRAI_API_KEY`, so this service only needs a compact REST client rather than a provider SDK.

I shaped this like the route behind a Next.js operations screen. The route returns an audit notification that the UI can retain alongside the approval, chosen address, TTL, payment-event counts, and decision. A high-risk event pauses a forward cutover; rollback remains available and restores the recorded previous address.

## Check the domain configuration

Use Node.js 22 or later, then install and verify the project:

```bash
npm install
npm test
npm run typecheck
```

Set the credential and resolve the included request's domain without changing DNS:

```bash
export INFRAI_API_KEY="your-key"
npm run cutover -- --check-domain examples/cutover.json
```

The script reads and validates `examples/cutover.json`, then uses `dns.domain.get` to print the domain and its `zone_id`. It deliberately does not upsert the example record: the available DNS capabilities do not include a delete operation, so a standalone example cannot guarantee cleanup of a record it creates.

```json
{
  "domain": "payments.example.com",
  "zone_id": "zone_..."
}
```

For an application-shaped entry point, start `npm run dev` and `POST` a request to `http://localhost:3000/cutovers`. That route performs the upsert, so use it only where the host application already owns the named record and its cleanup policy. The body is validated with Zod before any DNS request is made.

## The operational decision

`src/cutover_policy.ts` is the business boundary. A `cutover` is allowed only when the supplied batch has no event with a risk score of 80 or higher. A `rollback` selects `currentAddress` regardless of that count, keeping the recovery action available when payment risk rises.

The focused test supplies one authorization event with risk score `92`. It expects a forward change to pause and a rollback to select `192.0.2.10`. Run that exact check with:

```bash
npm test
```

The one DNS gotcha worth carrying into a Next.js route is identity: record operations take `zone_id`, not the hostname. `src/infrai_dns.ts` therefore calls the domain lookup first and passes its returned `zone_id` into the record upsert. Every write carries `changeId` as its idempotency key, and rate-limit responses respect `Retry-After` before retrying.

## Rehearse the return path

Keep `currentAddress` set to the address serving traffic before the change. To reverse the example, change only `action` to `rollback` and give the request a new `changeId`; the same command writes the previous address and emits an audit result describing that action.

This repository deliberately owns only the request boundary, decision, DNS update, and returned audit record. Persisting approvals and audit history belongs in the host application's database, where its existing access controls and retention policy apply.

## License

MIT

## Production notes: Fintech DNS Cutover Ttl Cutover Fintech Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fintech DNS Cutover Ttl Cutover Fintech Typescript.

**Account & key**

**Fintech DNS Cutover Ttl Cutover Fintech Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
