// pinecone-prepare-docs.ts

import path from "path";
import fs from "fs/promises";

import { env } from "@/lib/config";
import { getPineconeIndex } from "@/lib/pinecone/client";

import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";


type ToEmbed = { id: string; text: string; metadata: Record<string, any> };
type DocVisibility = "private" | "public";

type DocSourceConfig = {
  name: "private-docs" | "public-docs";
  dir: string;
  visibility: DocVisibility;
  publicUrlBase?: string;
};

const docSources: DocSourceConfig[] = [
  {
    name: "private-docs",
    dir: path.resolve(process.cwd(), "src/lib/docs/private"),
    visibility: "private",
  },
  {
    name: "public-docs",
    dir: path.resolve(process.cwd(), "src/lib/docs/public"),
    visibility: "public",
    publicUrlBase: env.PUBLIC_DOCS_BASE_URL,
  },
];

async function listPdfFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...(await listPdfFiles(full)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        out.push(full);
      }
    }
  } catch (err) {
    console.error(`Failed to read directory: ${dir}`, err);
  }
  return out;
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function buildPublicUrl(base: string | undefined, relativePath: string) {
  if (!base) return null;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizedBase}/${encodedPath}`;
}

(async () => {
  try {
    const index = await getPineconeIndex({ createIfMissing: true });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1600,
      chunkOverlap: 150,
    });

    const toEmbed: ToEmbed[] = [];
    let totalPdfFiles = 0;

    for (const source of docSources) {
      const hasDirectory = await directoryExists(source.dir);
      if (!hasDirectory) {
        console.warn(`[DocsPrep] Skipping ${source.name}; directory not found: ${source.dir}`);
        continue;
      }

      const pdfPaths = await listPdfFiles(source.dir);
      if (pdfPaths.length === 0) {
        console.log(`[DocsPrep] No PDF files found for ${source.name} (${source.dir}); skipping.`);
        continue;
      }

      totalPdfFiles += pdfPaths.length;
      console.log(`[DocsPrep] Found ${pdfPaths.length} PDF(s) in ${source.name}. Loading and splitting...`);

      for (const filePath of pdfPaths) {
        const relPathFromSource = path.relative(source.dir, filePath);
        const normalizedRelPath = normalizeRelativePath(relPathFromSource);
        const idPrefix = `${source.name}/${normalizedRelPath}`;

        const buffer = await fs.readFile(filePath);
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        await parser.destroy();

        const text = pdfData.text.trim();
        if (!text) continue;

        const chunks = await splitter.splitText(text);
        for (let j = 0; j < chunks.length; j++) {
          const metadata: Record<string, any> = {
            source_path: idPrefix, // includes bucket prefix (publicDocs/privateDocs)
            file_name: path.basename(relPathFromSource),
            chunk_index: j,
            chunk_text: chunks[j],
            source_visibility: source.visibility,
            source_bucket: source.name,
            is_public: source.visibility === "public",
          };

          if (source.visibility === "public") {
            const publicUrl = buildPublicUrl(source.publicUrlBase, normalizedRelPath);
            if (publicUrl) {
              metadata.public_url = publicUrl;
            } else {
              console.warn(`[DocsPrep] PUBLIC_DOCS_BASE_URL is not set; public doc "${normalizedRelPath}" will not have a CTA URL.`);
            }
          }

          toEmbed.push({
            id: `${idPrefix}#c${j}`,
            text: chunks[j],
            metadata,
          });
        }
      }
    }

    if (totalPdfFiles === 0) {
      console.log("No PDF files found across configured doc sources; aborting.");
      return;
    }

    if (toEmbed.length === 0) {
      console.log("No text chunks produced from PDFs; aborting.");
      return;
    }

    const namespace = "docs";
    const nsi = index.namespace(namespace);

    const embeddingModelSlug = env.OPENAI_EMBEDDING_MODEL;
    const embeddingModel = openai.textEmbeddingModel(embeddingModelSlug);

    console.log(`Embedding ${toEmbed.length} chunks using ${embeddingModelSlug}...`);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: toEmbed.map((t) => t.text),
    });

    const vectors = toEmbed.map((t, i) => ({
      id: t.id,
      values: embeddings[i] as number[],
      metadata: t.metadata,
    }));
  
    try {
      console.log(`Clearing existing vectors in namespace: ${namespace}`);
      await nsi.deleteAll();
    } catch (err: any) {
      if (err.name === "PineconeNotFoundError") {
        console.warn(`Namespace '${namespace}' not found yet. Skipping deleteAll.`);
      } else {
        throw err;
      }
    }

    console.log(`Upserting ${vectors.length} vectors to Pinecone (ns: ${namespace})...`);
    const batchSize = 100;
    for (let start = 0; start < vectors.length; start += batchSize) {
      const end = Math.min(start + batchSize, vectors.length);
      const batch = vectors.slice(start, end);
      await nsi.upsert(batch as any);
    }

    console.log("PDF embeddings stored in Pinecone successfully.");
  } catch (err) {
    console.error("Docs preparation failed", err);
  }
})();
