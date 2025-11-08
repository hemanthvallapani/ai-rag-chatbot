import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { generateEmbedding } from '../../../lib/embed';
import { retrieveTopChunks, buildContext } from '../../../lib/retrieve';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  enableLLM: boolean;
}

export interface ChatResponse {
  answer: string;
  pathway: 'kb-only' | 'kb-augmented' | 'llm-fallback';
  citation: string | null;
}


export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, enableLLM } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('Processing query:', message);
    console.log('Enable LLM:', enableLLM);

    // 1) Generate embedding for user question
    const queryEmbedding = await generateEmbedding(message);
    console.log('✅ Generated query embedding');

    // 2) Retrieve top-k chunks (NO MIN SIMILARITY)
    const chunks = retrieveTopChunks(queryEmbedding, 3);
    console.log('✅ Retrieved top chunks:', chunks.length);
    if (chunks.length > 0) {
      console.log("Top similarity:", chunks[0].similarity);
    }

    // 3) Build context (even if similarity low)
    const context = buildContext(chunks);

    // ✅ KB-ONLY MODE (toggle OFF)
   

    if (!enableLLM) {
      console.log('➡️  Using KB-ONLY mode');

      const systemPrompt = `
You are a helpful assistant that answers questions STRICTLY from the provided context.

RULES:
1. ONLY use information from the context.
2. If the answer is not clearly in the context, respond exactly:
   "I don't know based on the internal docs."
3. Be concise and factual.
`;

      const userPrompt = `
Context:
${context}

User question: ${message}

Remember: If you cannot answer using ONLY the context, say:
"I don't know based on the internal docs."
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      });

      let answer = completion.choices[0].message.content || "";

      // If model refuses → enforce rule
      if (
        answer.toLowerCase().includes("don't know") ||
        answer.toLowerCase().includes("cannot answer")
      ) {
        answer = "I don't know based on the internal docs.";
      }

      return NextResponse.json({
        answer,
        pathway: "kb-only",
        citation: "Source: Internal Docs",
      });
    }

    // ✅ LLM + KB MODE (toggle ON)
    

    const TOP_SIM = chunks[0]?.similarity ?? 0;
    const THRESHOLD = 0.60;

    if (TOP_SIM >= THRESHOLD) {
      console.log("➡️  Using KB-AUGMENTED mode (good similarity)");

      const systemPrompt = `
Use the internal documentation (context) to answer the user's question.
If the context contains the answer, respond using it clearly.
`;

      const userPrompt = `
Context:
${context}

User question: ${message}
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const answer = completion.choices[0].message.content || "";

      return NextResponse.json({
        answer,
        pathway: "kb-augmented",
        citation: "Source: Internal Docs",
      });
    }

    // ✅ LLM FALLBACK
   

    console.log("➡️  Using LLM-FALLBACK mode (low similarity)");
    const fallbackSystemPrompt = `
You are a helpful assistant. The user's question is NOT covered by the internal documentation.
Use general knowledge to provide the best possible answer.
`;

    const fallbackCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: fallbackSystemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
    });

    const fallbackAnswer = fallbackCompletion.choices[0].message.content || "";

    return NextResponse.json({
      answer: fallbackAnswer,
      pathway: "llm-fallback",
      citation: null,
    });

  } catch (err) {
    console.error("❌ ERROR in chat route:", err);
    return NextResponse.json(
      { error: "Server error occurred" },
      { status: 500 }
    );
  }
}
