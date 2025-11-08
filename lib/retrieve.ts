import { cosineSimilarity } from './embed';
import embeddingsData from '../data/embeddings.json';

export interface RetrievalResult {
  text: string;
  similarity: number;
  index: number;
}

export interface EmbeddingChunk {
  text: string;
  embedding: number[];
  index: number;
}

export function retrieveTopChunks(
  queryEmbedding: number[],
  topK: number = 3,
): RetrievalResult[] {

  const chunks = embeddingsData.chunks as EmbeddingChunk[];

  if (!chunks || chunks.length === 0) {
    console.log("❌ No chunks found in embeddings.json");
    return [];
  }

  // Compute similarity for every chunk
  const results = chunks.map(chunk => ({
    text: chunk.text,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    index: chunk.index,
  }));

  // Sort and ALWAYS return top-k (no threshold filtering)
  const topResults = results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return topResults;
}

export function buildContext(results: RetrievalResult[]): string {
  if (!results || results.length === 0) {
    return '';
  }

  return results
    .map((result, idx) => `[Context ${idx + 1}]\n${result.text}`)
    .join('\n\n---\n\n');
}

