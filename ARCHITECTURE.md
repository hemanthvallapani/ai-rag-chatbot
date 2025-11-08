# RAG Chatbot System Architecture

## Overview

This document describes the complete breakdown details of the Knowledge-Grounded RAG Chatbot system.

```
## Component Breakdown

### 1. Frontend Layer (Next.js + React)

**File**: `components/Chat.tsx`

**Responsibilities**:
- Render chat interface
- Manage conversation state
- Handle user input
- Display messages with citations
- Toggle between KB-only and LLM+KB modes

**Key Features**:
- Real-time message rendering
- Loading states with animated indicators
- Automatic scroll to latest message
- Mode toggle with visual feedback
- Citation display for KB-sourced answers

**Design Decisions**:
- Used React hooks (useState, useEffect, useRef) for state management
- No external state management library (Redux, Zustand) to keep it simple
- Tailwind CSS for responsive, utility-first styling
- Form submission prevents page reload
- Disabled input during API calls to prevent duplicate requests

### 2. API Layer (Next.js Route Handler)

**File**: `app/api/chat/route.ts`

**Responsibilities**:
- Handle HTTP POST requests
- Orchestrate RAG pipeline
- Implement dual-pathway logic
- Interface with OpenAI API
- Return structured responses

**Request Format**:
```typescript
{
  message: string;
  history: ChatMessage[];
  enableLLM: boolean;
}
```

**Response Format**:
```typescript
{
  answer: string;
  pathway: 'kb-only' | 'kb-augmented' | 'llm-fallback';
  citation: string | null;
}
```

**Pathway Decision Logic**:
```
┌──────────────────┐
│  User Message    │
└────────┬─────────┘
         │
         ▼
┌─────────────────────┐
│ Generate Embedding  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Retrieve Top Chunks │
│ (similarity ≥ 0.7)  │
└────────┬────────────┘
         │
         ▼
    ┌────┴────┐
    │enableLLM│
    └────┬────┘
         │
    ┌────┴─────┐
    │          │
   NO         YES
    │          │
    ▼          ▼
┌────────┐  ┌──────────────┐
│KB-ONLY │  │ Has chunks?  │
│  MODE  │  │ similarity   │
│        │  │   ≥ 0.75?    │
└───┬────┘  └──────┬───────┘
    │              │
    │         ┌────┴────┐
    │        YES       NO
    │         │         │
    ▼         ▼         ▼
┌────────┐ ┌─────────┐ ┌────────┐
│Chunks? │ │   KB-   │ │  LLM   │
│        │ │Augmented│ │Fallback│
└───┬────┘ └─────────┘ └────────┘
    │
┌───┴───┐
│      NO
YES     │
│       ▼
▼     "I don't know
Answer  based on docs"
with
citation
```

### 3. RAG Pipeline Components

#### 3a. Text Chunking (`lib/chunk.ts`)

**Purpose**: Split documents into semantically meaningful chunks

**Strategy**:
- Paragraph-based splitting to maintain context
- Configurable chunk size (default: 600 characters)
- Overlap between chunks (default: 100 characters) to avoid context loss
- Respects natural boundaries (paragraphs)

**Why This Approach?**:
- Paragraph boundaries preserve semantic meaning
- Overlap ensures context isn't lost at chunk edges
- 600-char chunks balance context vs. specificity
- Smaller than full documents but larger than sentences

**Example**:
```
Document: "Para1...\n\nPara2...\n\nPara3..."

Chunks:
- Chunk 0: "Para1...\n\nPara2..." (600 chars)
- Chunk 1: "...end of Para2\n\nPara3..." (overlap + new content)
```

#### 3b. Embedding Generation (`lib/embed.ts`)

**Purpose**: Convert text to vector representations

**Model**: OpenAI `text-embedding-3-small`
- Dimensions: 1536
- Cost-effective
- High quality for semantic search

**Key Functions**:
- `generateEmbedding()`: Single text → vector
- `generateEmbeddings()`: Batch processing for efficiency
- `cosineSimilarity()`: Compute similarity between vectors

**Why Cosine Similarity?**:
- Standard metric for text embeddings
- Measures angle between vectors (semantic similarity)
- Range: -1 to 1 (higher = more similar)
- Invariant to vector magnitude

#### 3c. Retrieval System (`lib/retrieve.ts`)

**Purpose**: Find most relevant chunks for a query

**Algorithm**:
1. Compute cosine similarity between query and all chunks
2. Filter by minimum threshold (0.7)
3. Sort by similarity (descending)
4. Return top-K results (default: 3)

**Parameters**:
- `topK`: Number of chunks to return
- `minSimilarity`: Threshold for relevance (0.7 = 70% similar)

**Why These Values?**:
- Top-3 balances context richness vs. token limits
- 0.7 threshold filters low-quality matches
- Prevents irrelevant context from confusing the LLM

**Context Building**:
```
[Context 1]
<chunk 1 text>

---

[Context 2]
<chunk 2 text>

---

[Context 3]
<chunk 3 text>
```

### 4. Ingestion Pipeline

**File**: `scripts/ingest.ts`

**Process**:
1. Read `data/faq.md`
2. Chunk text using `chunkText()`
3. Generate embeddings using OpenAI API
4. Save to `data/embeddings.json`

**Output Format**:
```json
{
  "chunks": [
    {
      "text": "chunk content...",
      "embedding": [0.023, -0.015, ...],
      "index": 0
    }
  ],
  "metadata": {
    "model": "text-embedding-3-small",
    "created_at": "2024-01-15T10:30:00Z",
    "total_chunks": 45
  }
}
```

**Why Run Once?**:
- Embeddings are deterministic (same text → same vector)
- Expensive API calls (cost + time)
- Only re-run when source documents change

### 5. Data Storage

**File**: `data/embeddings.json`

**Why Local JSON vs. Vector Database?**:

**Pros**:
-  No external dependencies
-  Simple deployment
-  Version controllable (Git)
-  Fast for small datasets (<1000 chunks)
-  No database setup/maintenance

**Cons**:
-  Not scalable to millions of vectors
-  Linear search (O(n) complexity)
-  Full file loaded into memory

**When to Migrate**:
- > 10,000 chunks → Use Pinecone, Weaviate, or Qdrant
- Multiple concurrent users → Use Redis with vector similarity
- Need filtering/metadata search → Use PostgreSQL with pgvector


## Pathway Logic Deep Dive

### KB-Only Mode (enableLLM = false)

**Goal**: Answer ONLY from internal docs; be conservative

**Flow**:
```
1. Retrieve chunks (similarity ≥ 0.7)
2. IF no chunks found:
     RETURN "I don't know based on the internal docs."
3. Build context from chunks
4. Prompt LLM with STRICT instructions:
     - Only use provided context
     - Say "I don't know..." if answer not in context
5. IF LLM response contains "don't know":
     RETURN "I don't know based on the internal docs."
6. ELSE:
     RETURN answer + "Source: Internal Docs"
```

### LLM + KB Mode (enableLLM = true)

**Goal**: Try KB first; fall back to general knowledge if needed

**Flow**:
```
1. Retrieve chunks (similarity ≥ 0.7)
2. IF chunks exist AND best_similarity ≥ 0.75:
     PATH: KB-Augmented
     - Use chunks as context
     - Allow general knowledge to supplement
     - RETURN answer + "Source: Internal Docs"
3. ELSE:
     PATH: LLM-Fallback
     - Use pure LLM knowledge
     - No context provided
     - RETURN answer (no citation)
```

**Threshold Rationale**:
- 0.75 similarity = high confidence in relevance
- Below 0.75 = chunks might be tangentially related → risky
- Fallback ensures always-helpful responses


## Edge Cases Handled

### 1. Empty Knowledge Base
**Scenario**: No embeddings exist
**Handling**: KB-only returns "I don't know"; LLM mode uses fallback

### 2. Very Short Messages
**Scenario**: User sends "hi" or "?"
**Handling**: Embeddings still generated; LLM responds naturally

### 3. Irrelevant Queries
**Scenario**: "What's the weather?" (not in KB)
**Handling**: KB-only → "I don't know"; LLM mode → answers from general knowledge

### 4. Follow-up Questions
**Scenario**: "Tell me more" after previous answer
**Handling**: Conversation history passed to LLM for context

### 5. Multiple Similar Chunks
**Scenario**: Query matches multiple chunks equally
**Handling**: Top-3 returned; LLM synthesizes comprehensive answer

### 6. API Failures
**Scenario**: OpenAI API returns error
**Handling**: Try-catch blocks; user-friendly error messages

### 7. Rate Limiting
**Scenario**: Too many API calls
**Handling**: Graceful error; user informed to retry

## Performance Considerations

### Ingestion
- **Time**: ~1-2 minutes for 50 chunks
- **Cost**: ~$0.001 per 1,000 tokens (very cheap)
- **Optimization**: Batch embedding generation

### Retrieval
- **Time**: < 100ms for 50 chunks (linear search)
- **Memory**: Entire embeddings.json loaded (~5MB for 50 chunks)
- **Scalability**: Consider vector DB if > 1,000 chunks

### Chat Response
- **Time**: 1-3 seconds (dominated by LLM generation)
- **Breakdown**:
  - Embedding query: ~200ms
  - Retrieval: ~50ms
  - LLM generation: 1-2.5s
- **Cost**: ~$0.0001 per query (GPT-4o-mini)


## Conclusion

This RAG chatbot demonstrates a complete, production-ready implementation of:
- Custom RAG pipeline without heavy frameworks
- Intelligent pathway routing (KB-only vs. LLM+KB)
- Clean separation of concerns (chunking, embedding, retrieval, generation)
- Type-safe, maintainable codebase
- Simple deployment (no external databases)

The architecture balances simplicity with functionality, making it ideal for small-to-medium knowledge bases while remaining extensible for future enhancements.