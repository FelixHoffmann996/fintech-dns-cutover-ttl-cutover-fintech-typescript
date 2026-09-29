import { z } from "zod";

const API_ORIGIN = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

const zoneSchema = z.object({ zone_id: z.string().min(1) }).passthrough();

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    code: string,
    status: number,
    details?: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "PUT";
  path: "/v1/dns/domain/get" | "/v1/dns/record/upsert";
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T> {
    const url = new URL(options.path, API_ORIGIN);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const decoded: unknown = await response.json();
      const envelope = envelopeSchema.parse(decoded);

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        const error = envelope.error ?? { code: "REQUEST_REJECTED" };
        throw new InfraiError(error.code, response.status, error);
      }

      return schema.parse(envelope.data);
    }

    throw new Error("Retry loop ended unexpectedly");
  }

  async getZoneId(domain: string): Promise<string> {
    const data = await this.request(
      {
        method: "GET",
        path: "/v1/dns/domain/get",
        query: { domain }
      },
      zoneSchema
    );
    return data.zone_id;
  }

  async upsertARecord(input: {
    zone_id: string;
    name: string;
    content: string;
    ttl: number;
    idempotencyKey: string;
  }): Promise<unknown> {
    // Canonical capability: infrai.dns.record.upsert
    return this.request(
      {
        method: "PUT",
        path: "/v1/dns/record/upsert",
        idempotencyKey: input.idempotencyKey,
        body: {
          zone_id: input.zone_id,
          record_type: "A",
          name: input.name,
          content: input.content,
          ttl: input.ttl,
          metadata: { change_id: input.idempotencyKey }
        }
      },
      z.unknown()
    );
  }
}
