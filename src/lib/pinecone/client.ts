import { env } from '@/lib/config';

import { Pinecone } from "@pinecone-database/pinecone";

// Keep a single Pinecone client across hot-reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __pineconeClient: Pinecone | undefined;
}


/**
 * Returns a cached Pinecone client (singleton).
 * Reuses a global instance across dev hot-reloads, otherwise creates one.
 *
 * Requires env var `PINECONE_API_KEY`.
 * @throws Error when `PINECONE_API_KEY` is missing.
 */
export async function getPineconeClient(): Promise<Pinecone> {
  if (globalThis.__pineconeClient) return globalThis.__pineconeClient;
  const apiKey = env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PINECONE_API_KEY env var");
  }
  const client = new Pinecone({ apiKey });
  // Cache on globalThis to survive module reloads in dev
  globalThis.__pineconeClient = client;
  return client;
}
export type { Pinecone };

type Metric = "cosine" | "dotproduct" | "euclidean";
type PineconeIndex = ReturnType<Pinecone["index"]>;



/**
 * Returns a Pinecone index specified by `PINECONE_INDEX_NAME`.
 * When `createIfMissing` is true, ensures the index exists by creating it if absent.
 *
 * Creation behavior (current implementation):
 * - dimension: taken from `env.EMBEDDING_DIMENSIONS` (number; required when creating)
 * - metric: from `params.metric` or defaults to "cosine"
 * - serverless location: cloud "aws", region "us-east-1" (fixed)
 *
 * Requires `PINECONE_INDEX_NAME` and a valid Pinecone client (`PINECONE_API_KEY`).
 * @throws Error if required env vars are missing or creation fails.
 */
export async function getPineconeIndex(params?: {
  createIfMissing?: boolean;
  dimension?: number;
  metric?: Metric;
  cloud?: string;
  region?: string;
}): Promise<PineconeIndex> {
  const client = await getPineconeClient();

  const indexName = env.PINECONE_INDEX_NAME;
  if (!indexName) throw new Error("Missing PINECONE_INDEX_NAME env var");

  if (!params?.createIfMissing) {
    return client.index(indexName);
  }

  // Check if index exists first
  try {
    const list: any = await client.listIndexes();
    const names: string[] = Array.isArray(list)
      ? list.map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean)
      : (list?.indexes?.map((i: any) => i?.name).filter(Boolean) ?? []);

    const exists = names.includes(indexName);

    if (!exists) {

      const dimension = Number(env.EMBEDDING_DIMENSIONS)

      const metric: Metric = params?.metric ?? ("cosine" as Metric);
      await client.createIndex({
        name: indexName,
        dimension,
        metric,
        spec: { serverless: { cloud: "aws", region: "us-east-1" } },
        waitUntilReady: true,
      } as any);
    } 
    
  } catch (err) {
    throw new Error(`Failed to ensure Pinecone index: ${(err as Error).message}`);
  }

  return client.index(indexName);
}

export type { PineconeIndex };
