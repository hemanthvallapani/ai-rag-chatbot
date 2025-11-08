# Knowledge-Grounded RAG Chatbot

A production-ready Retrieval-Augmented Generation (RAG) chatbot built with Next.js, TypeScript, and OpenAI. This system features two distinct response pathways: strict KB-only mode and LLM-augmented mode with intelligent fallback.

## Features

- **Dual Response Modes**
  - **KB-Only Mode**: Strict retrieval-only responses from internal documentation
  - **LLM + KB Mode**: Intelligent fallback to general LLM when knowledge base lacks information

- **Local Vector Store**: Simple JSON-based embedding storage (no external database required)

- **Custom RAG Pipeline**: Built from scratch with chunking, embedding, and retrieval

- **Clean UI**: Minimal, functional chat interface with conversation history

- **Source Attribution**: Automatic citation when answers come from internal docs

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **AI/ML**: OpenAI API (embeddings + chat)
- **Styling**: Tailwind CSS
- **Vector Store**: Local JSON file

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

## Installation

1. **Clone or download this repository**
```bash
git clone https://github.com/hemanthvallapani/ai-rag-chatbot.git
cd ai-rag-chatbot
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:
```bash
cp .env.sample .env.local
```

Edit `.env.local` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

## Setup and Running

### Step 1: Ingest Documents

Before running the chatbot, you need to process the FAQ document and generate embeddings:
```bash
npm run ingest
```

This script will:
- Read `data/faq.md`
- Chunk the text into semantic segments
- Generate embeddings using OpenAI's `text-embedding-3-small` model
- Save embeddings to `data/embeddings.json`

**Expected output:**
```
🚀 Starting document ingestion...
📄 Reading FAQ document...
✂️  Chunking text...
   Created 45 chunks
🧮 Generating embeddings...
   This may take a minute...
   Generated 45 embeddings
💾 Saving embeddings to file...
✅ Ingestion complete!
```

### Step 2: Run the Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 3: Build for Production (Optional)
```bash
npm run build
npm start
```

## How to Use

### Basic Usage

1. Open the application in your browser
2. Type your question in the input box
3. Click "Send" or press Enter
4. View the response with optional source citation

### Toggle Modes

**KB-Only Mode (Default - Checkbox Unchecked)**
- Only answers from internal documentation
- If answer not found, responds: "I don't know based on the internal docs."
- All successful answers include: `Source: Internal Docs`

**LLM + KB Mode (Checkbox Checked)**
- First tries to answer from knowledge base
- If relevant context found (similarity ≥ 0.75): Uses KB-augmented response with citation
- If no relevant context: Falls back to general LLM knowledge (no citation)

```
## License

MIT

## Support

For issues or questions, please check the ARCHITECTURE.md file for detailed system design information.
