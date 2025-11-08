export interface TextChunk {
  text: string;
  index: number;
}

export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): TextChunk[] {
  const chunks: TextChunk[] = [];
  
  // Split by paragraphs first to maintain semantic boundaries
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + trimmedParagraph.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++
      });
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5)); // Rough word estimate
      currentChunk = overlapWords.join(' ') + ' ' + trimmedParagraph;
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
    
    // If current chunk exceeds max size significantly, force split
    if (currentChunk.length > chunkSize * 1.5) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++
      });
      currentChunk = '';
    }
  }
  
  // Add final chunk if not empty
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex
    });
  }
  
  return chunks;
}

export function cleanText(text: string): string {
  // Remove markdown headers
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ');
  
  // Remove extra newlines but keep paragraph breaks
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}