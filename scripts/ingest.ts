import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { chunkText } from '../lib/chunk';
import { generateEmbeddings } from '../lib/embed';

// Load environment variables from .env.local or .env
dotenv.config({ path: '.env.local' });
dotenv.config();

async function ingestDocuments() {
  console.log('🚀 Starting document ingestion...\n');
  
  // Read the FAQ document
  const faqPath = path.join(process.cwd(), 'data', 'faq.md');
  console.log('📄 Reading FAQ document...');
  const faqContent = fs.readFileSync(faqPath, 'utf-8');
  
  // Chunk the text
  console.log('✂️  Chunking text...');
  const chunks = chunkText(faqContent, 600, 100);
  console.log(`   Created ${chunks.length} chunks\n`);
  
  // Generate embeddings
  console.log('🧮 Generating embeddings...');
  console.log('   This may take a minute...');
  const texts = chunks.map(chunk => chunk.text);
  const embeddings = await generateEmbeddings(texts);
  console.log(`   Generated ${embeddings.length} embeddings\n`);
  
  // Prepare data structure
  const embeddingsData = {
    chunks: chunks.map((chunk, idx) => ({
      text: chunk.text,
      embedding: embeddings[idx],
      index: chunk.index,
    })),
    metadata: {
      model: 'text-embedding-3-small',
      created_at: new Date().toISOString(),
      total_chunks: chunks.length,
    },
  };
  
  // Save to file
  const outputPath = path.join(process.cwd(), 'data', 'embeddings.json');
  console.log('💾 Saving embeddings to file...');
  fs.writeFileSync(outputPath, JSON.stringify(embeddingsData, null, 2));
  
  console.log('✅ Ingestion complete!');
  console.log(`   Embeddings saved to: ${outputPath}`);
  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   Model: text-embedding-3-small\n`);
}

// Run the ingestion
ingestDocuments().catch(error => {
  console.error('❌ Error during ingestion:', error);
  process.exit(1);
});