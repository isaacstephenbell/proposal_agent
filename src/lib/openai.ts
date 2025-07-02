import OpenAI from 'openai';
import { ProposalChunk } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

// Generate embeddings for text
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Generate proposal based on retrieved chunks
export async function generateProposal(
  problem: string,
  chunks: ProposalChunk[],
  clientName?: string
): Promise<string> {
  try {
    const systemPrompt = `You are a proposal writer. Use only the provided historical context to generate a new proposal.
Do not invent facts. Structure the proposal with:
1. Our Understanding
2. Proposed Approach  
3. Timeline / Workplan

Base your response on the actual historical proposals provided. If the context doesn't contain relevant information for a section, indicate that clearly.`;

    const contextText = chunks.map(chunk => 
      `Client: ${chunk.metadata.client}\nFilename: ${chunk.metadata.filename}\nContent: ${chunk.content}`
    ).join('\n---\n');

    const userPrompt = `Problem Statement: ${problem}${clientName ? `\nClient: ${clientName}` : ''}

Historical Context:
${contextText}

Generate a structured proposal based on the above context.`;

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });

    return chatCompletion.choices[0].message?.content || '';
  } catch (error) {
    console.error('Error generating proposal:', error);
    throw error;
  }
}

// Answer questions about historical proposals
export async function answerQuestion(
  question: string,
  chunks: ProposalChunk[]
): Promise<string> {
  try {
    const systemPrompt = `You are a proposal assistant. Answer the user's question based ONLY on the provided historical proposal data. 
Do not invent any information. If the data doesn't contain the answer, say so clearly.
Be concise and specific in your response.`;

    const contextText = chunks.map(chunk => 
      `Client: ${chunk.metadata.client}\nFilename: ${chunk.metadata.filename}\nContent: ${chunk.content}`
    ).join('\n---\n');

    const userPrompt = `Question: ${question}

Historical Data:
${contextText}

Answer the question based on this data.`;

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    });

    return chatCompletion.choices[0].message?.content || '';
  } catch (error) {
    console.error('Error answering question:', error);
    throw error;
  }
} 