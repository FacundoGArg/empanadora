import z from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().trim().min(1),
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_EMBEDDING_MODEL: z.string().trim().min(1),
  EMBEDDING_DIMENSIONS:  z.string().trim().min(1),
  PINECONE_API_KEY: z.string().trim().min(1),
  PINECONE_INDEX_NAME: z.string().trim().min(1),
  PUBLIC_DOCS_BASE_URL: z.string().trim().min(1).optional(),
  EVAL_BASE_URL: z.string().trim().min(1).optional(),
});

export const env = envSchema.parse(process.env);
