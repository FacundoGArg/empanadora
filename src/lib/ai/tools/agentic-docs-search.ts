// agentic-docs-search.ts

import { tool, generateObject, embed } from 'ai';
import { z } from 'zod';
import { getPineconeIndex } from '@/lib/pinecone/client';
import { env } from '@/lib/config';
import { openai } from '@ai-sdk/openai';

// Allow a couple of retrieval iterations before giving up.
const MAX_ATTEMPTS = 2;
const MIN_RELEVANT = 1;

type RetrievedDoc = {
  id: string | null;
  score: number | null;
  path: string | null;
  pageNumber: number | null;
  text: string | null;
  chunkIndex: number | null;
  isPublic: boolean;
  publicUrl: string | null;
};

async function pineconeQuery(prompt: string, topK: number = 5): Promise<RetrievedDoc[]> {
  // Issue a semantic search against our Pinecone namespace.
  console.log(`[docsSearch] Querying Pinecone with prompt="${prompt}" topK=${topK}`);

  const index = await getPineconeIndex();
  const namespace = 'docs';

  const embeddingModel = openai.textEmbeddingModel(env.OPENAI_EMBEDDING_MODEL);
  const { embedding: queryVector } = await embed({ model: embeddingModel, value: prompt });

  const result: any = await index
    .namespace(namespace)
    .query({
      vector: queryVector as number[],
      topK,
      includeValues: false,
      includeMetadata: true,
    } as any);

  const matches = Array.isArray(result?.matches) ? result.matches : [];
  console.log(`[docsSearch] Retrieved ${matches.length} raw matches`);
  // Debug: log top scores
  try {
    const dbg = matches
      .slice(0, Math.min(matches.length, 5))
      .map((m: any) => `${m?.id ?? 'id?'}:${(m?.score ?? 0).toFixed(3)}`)
      .join(', ');
    console.log(`[docsSearch] Top scores: ${dbg}`);
  } catch {}

  // Pinecone score pre-filter (cosine similarity: higher is better). Be conservative; fallback if empty.
  const SCORE_THRESHOLD = 0.5;
  let filtered = matches.filter((m: any) => typeof m?.score === 'number' ? m.score >= SCORE_THRESHOLD : true);
  if (filtered.length === 0 && matches.length > 0) {
    console.log(`[docsSearch] Score filter removed all matches; falling back to unfiltered topK.`);
    filtered = matches;
  }

  return filtered.map((m: any) => ({
    id: m?.id ?? null,
    score: typeof m?.score === 'number' ? m.score : null,
    path: m?.metadata?.source_path ?? null,
    pageNumber: typeof m?.metadata?.page_number === 'number' ? m.metadata.page_number : null,
    text: m?.metadata?.chunk_text ?? null,
    chunkIndex: typeof m?.metadata?.chunk_index === 'number' ? m.metadata.chunk_index : null,
    isPublic: Boolean(m?.metadata?.is_public),
    publicUrl: typeof m?.metadata?.public_url === 'string' ? m.metadata.public_url : null,
  }));
}

async function checkRelevance(userQuery: string, docs: RetrievedDoc[]) {
  // Ask an LLM to prune Pinecone matches that do not explicitly answer the query.
  console.log(`[docsSearch] Checking relevance of ${docs.length} docs for query="${userQuery}"`);

  if (!docs.length) return { filtered: [], reason: 'No documents to evaluate.' };

  const MAX_SNIPPETS = 10;
  const MAX_CHARS = 800;
  const snippets = docs.slice(0, MAX_SNIPPETS).map(d => ({
    ...d,
    text: String(d.text ?? '').slice(0, MAX_CHARS),
  }));

  const relevanceCheck = await generateObject({
    model: openai('gpt-4o-mini'),
    temperature: 0,
    system: `
      You are a strict judge of relevance.
      Given a user query and a set of document excerpts, include only IDs that explicitly answer or directly describe the requested fact.
      Do not infer. If none are relevant, return an empty list. Return at most 5 IDs.
    `,
    schema: z.object({
      relevantIds: z.array(z.string()),
      reason: z.string().optional(),
    }),
    messages: [
      { role: 'user', content: `Query: ${userQuery}\n\nDocs:\n${snippets.map(d => `[${d.id}] ${d.text}`).join('\n\n')}` }
    ],
  });

  console.log(`[docsSearch] Relevance reasoning: ${relevanceCheck.object.reason}`);
  console.log(`[docsSearch] Relevant IDs: ${relevanceCheck.object.relevantIds}`);

  const relevantIds = new Set(relevanceCheck.object.relevantIds);
  const filtered = docs.filter(d => (d.id ? relevantIds.has(d.id) : false));

  return { filtered, reason: relevanceCheck.object.reason ?? '' };
}

function enforceConservativeRephrase(original: string, candidate: string): string {
  // Filter out paraphrases that broaden the query or add conjunctions that change scope.
  const o = original.trim();
  const c = (candidate || '').trim();
  if (!c) return o;
  if (c.length > o.length * 1.25) return o;
  const introducesConjunction = /\b(and|y)\b/i.test(c) && !/\b(and|y)\b/i.test(o);
  if (introducesConjunction) return o;
  return c;
}

async function rephraseQuery(currentPrompt: string, attempt: number) {
  // When retrieval fails, paraphrase the query slightly to explore nearby embedding space.
  console.log(`[docsSearch] Attempt ${attempt + 1} failed, rephrasing query...`);

  const reph = await generateObject({
    model: openai('gpt-4o-mini'),
    temperature: 0,
    system: `
      Strictly paraphrase the user's query to improve semantic retrieval WITHOUT changing the intent, scope, language, or named entities.
      - Keep the same language as the user.
      - Do NOT broaden the question (no extra attributes, examples, or secondary asks).
      - Preserve all named entities and specific constraints as-is.
      - Keep it concise; prefer shorter or equal length.
      - If the original is already precise, return it unchanged.
    `,
    schema: z.object({ newQuery: z.string() }),
    messages: [{ role: 'user', content: currentPrompt }],
  });

  const nextQuery = enforceConservativeRephrase(currentPrompt, reph.object.newQuery);
  console.log(`[docsSearch] New rephrased query: "${nextQuery}"`);
  return nextQuery;
}

export const docsSearch = tool({
  description: 'Iterative semantic search with relevance checking over accommodation PDF docs.',
  inputSchema: z.object({
    prompt: z.string().describe('Generate a prompt based on user intent, to query vector database'),
    userQuery: z.string().describe('The original user query'),
  }),
  execute: async ({ prompt, userQuery }) => {
    // Keep looping until we either find enough relevant chunks or exhaust attempts.
    let attempts = 0;
    let relevantDocs: RetrievedDoc[] = [];
    let lastReason = '';

    while (attempts < MAX_ATTEMPTS && relevantDocs.length < MIN_RELEVANT) {
      console.log(`\n[docsSearch] ===== Attempt ${attempts + 1} =====`);

      const docs = await pineconeQuery(prompt, 5 + attempts * 5);
      const { filtered, reason } = await checkRelevance(userQuery, docs);
      lastReason = reason;
      relevantDocs.push(...filtered);

      console.log(`[docsSearch] Found ${filtered.length} relevant docs this round (total so far: ${relevantDocs.length})`);

      if (relevantDocs.length >= MIN_RELEVANT) {
        console.log(`[docsSearch] ✅ Stopping early, enough relevant docs found`);
        break;
      }

      prompt = await rephraseQuery(prompt, attempts);
      attempts++;
    }

    // Deduplicate by id. Some Pinecone chunks overlap heavily, so avoid double-counting.
    const seen = new Set<string>();
    relevantDocs = relevantDocs.filter(d => {
      if (!d.id) return false;
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    console.log(`[docsSearch] Finished after ${attempts + 1} attempts. Relevant docs: ${relevantDocs.length}`);

    // Aggregate sources by path so the UI can present a deduplicated citation list.
    const sourceMap = new Map<string, { path: string; pages: number[]; url: string | null }>();
    for (const d of relevantDocs) {
      const p = d.path ?? 'unknown';
      const pg = typeof d.pageNumber === 'number' ? d.pageNumber : null;
      if (!sourceMap.has(p)) {
        sourceMap.set(p, { path: p, pages: [], url: null });
      }
      const entry = sourceMap.get(p)!;
      if (pg && !entry.pages.includes(pg)) entry.pages.push(pg);
      if (!entry.url && d.isPublic && d.publicUrl) {
        entry.url = d.publicUrl;
      }
    }
    // sort pages for neatness
    for (const v of sourceMap.values()) v.pages.sort((a, b) => a - b);

    return {
      attempts: attempts + 1,
      relevantCount: relevantDocs.length,
      reason: lastReason,
      results: relevantDocs,
      // Downstream we only surface clickable sources when an URL exists (i.e. doc is public).
      sources: Array.from(sourceMap.values()).filter((s) => Boolean(s.url)),
    };
  },
});
