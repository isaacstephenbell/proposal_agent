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

// Detect if query is asking for methodology/approach synthesis
function isMethodologyQuery(question: string): boolean {
  const methodologyIndicators = [
    /how (do )?(we|you) typically/i,
    /how (do )?(we|you) usually/i,
    /how (do )?(we|you) normally/i,
    /what is (our|your) (typical|usual|standard|normal) approach/i,
    /what is (our|your) methodology/i,
    /how (do|should) (we|you) approach/i,
    /what are (our|your) best practices/i,
    /how (do|should) (we|you) handle/i,
    /what is (our|your) process for/i,
    /how (do|should) (we|you) conduct/i,
    /what steps do (we|you) take/i,
    /what is (our|your) framework/i,
    /how (do|should) (we|you) structure/i,
    /share (our|your) (typical|usual|standard|normal|approach)/i,
    /explain (our|your) methodology/i,
    /(our|your) typical approach/i,
    /(our|your) usual approach/i,
    /(our|your) standard approach/i
  ];
  
  return methodologyIndicators.some(pattern => pattern.test(question));
}

// Answer questions about historical proposals
export async function answerQuestion(
  question: string,
  chunks: ProposalChunk[],
  formatInstructions?: string
): Promise<string> {
  try {
    const isMethodology = isMethodologyQuery(question);
    
    const defaultFormatInstructions = isMethodology 
      ? `Synthesize a unified methodology from all the historical data. Structure as:
- **Our Typical Approach**: Synthesized methodology drawn from all projects
- **Key Components**: Common elements we consistently use
- **Process Steps**: Typical workflow/phases we follow
- **Deliverables**: Standard outputs we usually provide
- **Best Practices**: Patterns that work well across projects`
      : `Use this consistent format for each project:
- **Project Name**: Brief description of the challenge/problem
- **Our Solution**: The approach taken and key deliverables
- **Timeline**: When the project occurred and duration
- **Key Activities**: Bullet points (•) of main activities performed`;

    const formatToUse = formatInstructions || defaultFormatInstructions;

    const systemPrompt = isMethodology 
      ? `You are a methodology synthesis expert. Analyze the provided historical proposal data to extract and synthesize common approaches, patterns, and methodologies.

SYNTHESIS REQUIREMENTS:
- ANALYZE all projects to identify common patterns and approaches
- SYNTHESIZE findings into ONE unified methodology (not individual project examples)  
- EXTRACT recurring themes, processes, and best practices
- FOCUS on "how we typically approach" rather than "what we did for specific clients"
- PRESENT as a cohesive methodology, not separate project descriptions

CONTENT FORMATTING:
${formatToUse}

SYNTHESIS APPROACH:
- Look for common methodologies across different projects
- Identify standard processes and workflows that repeat
- Extract typical deliverables and outputs we provide
- Find best practices and successful patterns
- Synthesize into one unified approach

DO NOT:
- List individual projects separately
- Say "Project A did X, Project B did Y"
- Give client-specific examples as the main response

DO:
- Say "Our typical approach involves..."
- Synthesize patterns: "We consistently use..."
- Present unified methodology: "Our standard process includes..."
- Reference patterns: "Based on our experience across multiple projects..."

Answer as if explaining your company's established methodology to a new team member.`
      : `You are a proposal assistant. Answer the user's question based ONLY on the provided historical proposal data. 

CRITICAL FORMATTING RULES:
- When listing multiple projects, use sequential numbering: 1. 2. 3. 4. 5. etc.
- NEVER repeat the same number - each project gets the next number in sequence
- Use bullet points (•) for sub-items and activities within each project
- Use **bold** for project names, client names, and key terms
- Include clear paragraph breaks between projects

CONTENT FORMATTING:
${formatToUse}

CONTENT REQUIREMENTS:
- Do not invent any information 
- If the data doesn't contain the answer, say so clearly
- Be specific and reference actual project details
- Include relevant details like timelines, deliverables, team members when available
- Apply the same formatting structure to ALL projects consistently

SEQUENTIAL NUMBERING EXAMPLES:
✅ CORRECT: 
"1. Project Name: First Project
[content]
2. Project Name: Second Project  
[content]
3. Project Name: Third Project
[content]"

❌ WRONG:
"1. Project Name: First Project
[content]
1. Project Name: Second Project
[content]
1. Project Name: Third Project
[content]"

REMEMBER: Each project must have a unique sequential number (1, 2, 3, 4, 5, etc.)`;

    const contextText = chunks.map(chunk => 
      `Client: ${chunk.metadata.client}\nFilename: ${chunk.metadata.filename}\nContent: ${chunk.content}`
    ).join('\n---\n');

    const userPrompt = isMethodology 
      ? `Question: ${question}

Historical Data from Multiple Projects:
${contextText}

SYNTHESIS TASK: Analyze the above historical data to identify common patterns, methodologies, and approaches. Extract what we consistently do across projects to create a unified methodology.

Focus on:
- Common processes and workflows
- Recurring methodologies and techniques  
- Standard deliverables and outputs
- Best practices that appear across multiple projects
- Typical timelines and phases

Synthesize this into ONE cohesive methodology that represents how we typically approach this type of work.${formatInstructions ? `\n\nFormat Requirements: ${formatInstructions}` : ''}`
      : `Question: ${question}

Historical Data:
${contextText}

IMPORTANT NUMBERING REMINDER: If you list multiple projects, number them sequentially like this:
1. [First project]
2. [Second project] 
3. [Third project]
4. [Fourth project]

DO NOT repeat numbers (1. 1. 1. 1.) - always increment (1. 2. 3. 4.)

Answer the question based on this data.${formatInstructions ? `\n\nFormat Requirements: ${formatInstructions}` : ''}`;

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