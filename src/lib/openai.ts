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

// Consultant Query Framework - Detect the type of consultant query
enum ConsultantQueryType {
  METHODOLOGY = 'methodology',           // How we typically approach X
  CLIENT_EXAMPLES = 'client_examples',   // Have we done X for Y clients?
  PROJECT_LIST = 'project_list',         // List all projects for client X
  DELIVERABLES = 'deliverables',         // What deliverables do we provide for X?
  PRICING = 'pricing',                   // What's our typical fee structure for X?
  RISKS = 'risks',                       // What are common risks in X projects?
  PROPOSAL_LANGUAGE = 'proposal_language', // Standard language for X
  INDUSTRY_EXPERIENCE = 'industry_experience', // What work have we done in X industry?
  OUTCOMES = 'outcomes',                 // What results do we achieve in X?
  GEOGRAPHIC = 'geographic',             // Experience in X region
  GENERAL = 'general'                    // Fall back to general project listing
}

interface QueryPattern {
  type: ConsultantQueryType;
  patterns: RegExp[];
}

const consultantQueryPatterns: QueryPattern[] = [
  {
    type: ConsultantQueryType.METHODOLOGY,
    patterns: [
      /how (do )?(we|you) typically/i,
      /how (do )?(we|you) usually/i,
      /how (do )?(we|you) normally/i,
      /how (do )?(we|you) approach.+typically/i,
      /how (do )?(we|you) approach.+usually/i,
      /how (do )?(we|you) approach.+normally/i,
      /tell me how (we|you) approach/i,
      /can you tell me how (we|you) approach/i,
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
      /(our|your) standard approach/i,
      /typically.+(how|approach|method)/i,
      /usually.+(how|approach|method)/i,
      /normally.+(how|approach|method)/i
    ]
  },
  {
    type: ConsultantQueryType.CLIENT_EXAMPLES,
    patterns: [
      /have we done .+ for .+ clients?/i,
      /have we worked with .+ clients/i,
      /do we have experience with .+ clients/i,
      /have we done .+ work for/i,
      /clients we.+ve worked with/i,
      /experience working with .+ clients/i
    ]
  },
  {
    type: ConsultantQueryType.PROJECT_LIST,
    patterns: [
      /list all projects for/i,
      /tell me all the projects .+ with/i,
      /show me all .+ projects/i,
      /what projects have we done (with|for)/i,
      /all of our work (with|for)/i,
      /everything we.+ve done (with|for)/i
    ]
  },
  {
    type: ConsultantQueryType.DELIVERABLES,
    patterns: [
      /what deliverables/i,
      /what outputs/i,
      /what artifacts/i,
      /what do we (deliver|provide)/i,
      /typical deliverables/i,
      /standard deliverables/i,
      /what are the outputs/i,
      /what documents do we/i
    ]
  },
  {
    type: ConsultantQueryType.PRICING,
    patterns: [
      /what.+s our (typical|usual|standard|normal) fee/i,
      /pricing/i,
      /fee structure/i,
      /how much do we charge/i,
      /what do we charge/i,
      /cost/i,
      /budget/i,
      /what.+s the fee/i
    ]
  },
  {
    type: ConsultantQueryType.RISKS,
    patterns: [
      /what are (the )?(common |typical )?risks/i,
      /risks we flag/i,
      /what risks do we/i,
      /mitigation/i,
      /challenges/i,
      /what could go wrong/i,
      /potential issues/i
    ]
  },
  {
    type: ConsultantQueryType.PROPOSAL_LANGUAGE,
    patterns: [
      /standard section/i,
      /proposal language/i,
      /sample language/i,
      /do we have (a )?standard/i,
      /boilerplate/i,
      /template/i,
      /copy for/i,
      /standard text/i
    ]
  },
  {
    type: ConsultantQueryType.INDUSTRY_EXPERIENCE,
    patterns: [
      /what work have we done in .+ (industry|sector)/i,
      /experience in .+ (industry|sector)/i,
      /clients in .+ (industry|sector)/i,
      /(healthcare|financial|technology|manufacturing|retail|education|government|nonprofit)/i,
      /industry experience/i,
      /sector experience/i
    ]
  },
  {
    type: ConsultantQueryType.OUTCOMES,
    patterns: [
      /what (results|outcomes|impact)/i,
      /what do we achieve/i,
      /typical results/i,
      /success stories/i,
      /what are the benefits/i,
      /impact/i,
      /roi/i,
      /return on investment/i
    ]
  },
  {
    type: ConsultantQueryType.GEOGRAPHIC,
    patterns: [
      /experience .+ in .+ (region|country|state|city)/i,
      /clients in .+ (region|country|state|city)/i,
      /work in .+ (region|country|state|city)/i,
      /(international|global|domestic|local)/i,
      /(north america|south america|europe|asia|africa|australia)/i,
      /(latin america|middle east)/i
    ]
  }
];

function detectConsultantQueryType(question: string): ConsultantQueryType {
  for (const queryPattern of consultantQueryPatterns) {
    if (queryPattern.patterns.some(pattern => pattern.test(question))) {
      return queryPattern.type;
    }
  }
  return ConsultantQueryType.GENERAL;
}

// Get format instructions based on consultant query type
function getFormatInstructions(queryType: ConsultantQueryType): string {
  switch (queryType) {
    case ConsultantQueryType.METHODOLOGY:
      return `**Synthesize a unified methodology** from all historical data. Structure as:
- **Our Typical Approach**: Unified methodology drawn from all projects
- **Key Components**: Common elements we consistently use
- **Process Steps**: Standard workflow/phases we follow
- **Deliverables**: Typical outputs we provide
- **Best Practices**: Proven patterns across projects`;

    case ConsultantQueryType.CLIENT_EXAMPLES:
      return `**List client examples** with context. Structure as:
- **Client Name**: Brief description of the work type
- **Project Focus**: Main area of engagement
- **Year**: When the work was completed (if available)
- **Key Outcomes**: Notable results or deliverables`;

    case ConsultantQueryType.PROJECT_LIST:
      return `**List all projects** for the specified client. Structure as:
- **Project Title**: Name or brief description
- **Type of Work**: Category of engagement
- **Timeline**: When the project occurred
- **Key Deliverables**: Main outputs provided`;

    case ConsultantQueryType.DELIVERABLES:
      return `**Consolidate deliverables** from similar projects. Structure as:
- **Standard Deliverables**: Most common outputs across projects
- **Specialized Outputs**: Unique deliverables for specific contexts
- **Formats**: Types of documents/materials typically provided
- **Timeline**: When deliverables are typically provided`;

    case ConsultantQueryType.PRICING:
      return `**Synthesize pricing patterns** from historical data. Structure as:
- **Fee Structure**: How we typically price this type of work
- **Typical Range**: Common pricing ranges (if available)
- **Pricing Model**: Fixed fee, T&M, or other approaches
- **Factors**: What influences pricing for this work`;

    case ConsultantQueryType.RISKS:
      return `**Consolidate risk patterns** from past projects. Structure as:
- **Common Risks**: Frequently encountered challenges
- **Mitigation Strategies**: How we typically address these risks
- **Early Warning Signs**: What to watch for
- **Best Practices**: Proven approaches to risk management`;

    case ConsultantQueryType.PROPOSAL_LANGUAGE:
      return `**Extract reusable proposal language**. Structure as:
- **Standard Section**: Copy-ready proposal text
- **Key Messages**: Main points to communicate
- **Customization Notes**: How to adapt for specific clients
- **Source References**: Where this language has been used`;

    case ConsultantQueryType.INDUSTRY_EXPERIENCE:
      return `**Summarize industry experience** across projects. Structure as:
- **Industry Focus**: Main areas of work in this sector
- **Client Examples**: Types of organizations we've served
- **Specialized Expertise**: Unique capabilities in this industry
- **Typical Projects**: Common engagement types`;

    case ConsultantQueryType.OUTCOMES:
      return `**Synthesize typical outcomes** from past projects. Structure as:
- **Quantitative Results**: Measurable impacts achieved
- **Qualitative Benefits**: Process improvements and capabilities
- **Success Metrics**: How we typically measure success
- **Client Testimonials**: Feedback from past engagements (if available)`;

    case ConsultantQueryType.GEOGRAPHIC:
      return `**Summarize geographic experience**. Structure as:
- **Regional Focus**: Main areas of work in this geography
- **Local Expertise**: Understanding of regional factors
- **Client Examples**: Organizations served in this region
- **Cultural Considerations**: Unique aspects of working in this area`;

    default:
      return `**List relevant projects** with context. Structure as:
- **Project Name**: Brief description of the challenge/problem
- **Client**: Organization served (if appropriate to share)
- **Our Solution**: The approach taken and key deliverables
- **Timeline**: When the project occurred and duration
- **Key Activities**: Main activities performed`;
  }
}

// Get system prompt based on consultant query type
function getSystemPrompt(queryType: ConsultantQueryType, formatInstructions: string): string {
  const commonRules = `
CRITICAL FORMATTING RULES:
- Use **bold** for headings, client names, and key terms
- Use bullet points (•) for sub-items within sections
- Include clear paragraph breaks between sections
- When listing multiple items, use sequential numbering: 1. 2. 3. 4. 5. etc.
- NEVER repeat the same number - each item gets the next number in sequence

CONTENT REQUIREMENTS:
- Base answers ONLY on the provided historical proposal data
- Do not invent any information
- If the data doesn't contain the answer, state this clearly
- Be specific and reference actual project details when available
- Use professional, concise language suitable for proposal writing

TONE GUIDELINES:
- Professional but concise
- Focus on what's most reusable for proposals
- Avoid excessive detail - highlight key points
- Structure responses as "quick-reference briefing notes"`;

  switch (queryType) {
    case ConsultantQueryType.METHODOLOGY:
      return `You are a methodology synthesis expert assisting a consultant writing a proposal. Your role is to analyze historical proposal data and synthesize common approaches into ONE unified methodology.

SYNTHESIS REQUIREMENTS:
- ANALYZE all projects to identify common patterns and approaches
- SYNTHESIZE findings into ONE unified methodology (not individual project examples)
- EXTRACT recurring themes, processes, and best practices
- FOCUS on "how we typically approach" rather than "what we did for specific clients"
- PRESENT as a cohesive methodology, not separate project descriptions

CONTENT FORMATTING:
${formatInstructions}

DO NOT:
- List individual projects separately
- Say "Project A did X, Project B did Y"
- Give client-specific examples as the main response

DO:
- Say "Our typical approach involves..."
- Synthesize patterns: "We consistently use..."
- Present unified methodology: "Our standard process includes..."
- Reference patterns: "Based on our experience across multiple projects..."

${commonRules}

Answer as if explaining your company's established methodology to a new team member writing their first proposal.`;

    case ConsultantQueryType.CLIENT_EXAMPLES:
      return `You are a proposal assistant helping to identify relevant client examples and case studies.

RESPONSE FOCUS:
- Identify specific clients or anonymized examples where this type of work was performed
- Include context about the type of work and outcomes
- Group similar types of engagements together
- Highlight relevant experience for proposal credibility

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a "relevant experience" section for a proposal.`;

    case ConsultantQueryType.PROJECT_LIST:
      return `You are a proposal assistant providing a comprehensive list of projects for a specific client.

RESPONSE FOCUS:
- List ALL projects for the specified client
- Include project titles, types of work, and timelines
- Organize chronologically or by type of engagement
- This is intentionally a list view - no need for detailed methodology synthesis

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a "past work summary" for the client relationship.`;

    case ConsultantQueryType.DELIVERABLES:
      return `You are a proposal assistant identifying standard deliverables and outputs.

RESPONSE FOCUS:
- Consolidate common deliverables from similar projects
- Organize by type or phase of engagement
- Include formats and timing of deliverables
- Focus on reusable deliverable descriptions for proposals

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a "deliverables" section for a proposal.`;

    case ConsultantQueryType.PRICING:
      return `You are a proposal assistant analyzing pricing patterns and fee structures.

RESPONSE FOCUS:
- Synthesize pricing approaches from historical data
- Identify common fee structures and pricing models
- Note factors that influence pricing
- Be careful not to reveal specific client pricing details

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing pricing guidance for a proposal team.`;

    case ConsultantQueryType.RISKS:
      return `You are a proposal assistant identifying common risks and mitigation strategies.

RESPONSE FOCUS:
- Consolidate risks that appear across multiple projects
- Include proven mitigation strategies
- Focus on proactive risk management approaches
- Organize by likelihood or impact

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a "risk management" section for a proposal.`;

    case ConsultantQueryType.PROPOSAL_LANGUAGE:
      return `You are a proposal assistant extracting reusable proposal language and standard sections.

RESPONSE FOCUS:
- Extract copy-ready text that can be reused in proposals
- Include standard messaging and key points
- Note how language can be customized for different clients
- Focus on well-written, professional proposal content

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing reusable content for the proposal library.`;

    case ConsultantQueryType.INDUSTRY_EXPERIENCE:
      return `You are a proposal assistant summarizing industry-specific experience and expertise.

RESPONSE FOCUS:
- Consolidate experience within the specified industry or sector
- Highlight specialized expertise and understanding
- Include relevant client examples and project types
- Group by sub-sectors or types of work within the industry

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing an "industry experience" section for a proposal.`;

    case ConsultantQueryType.OUTCOMES:
      return `You are a proposal assistant synthesizing typical outcomes and impact metrics.

RESPONSE FOCUS:
- Consolidate results and outcomes from similar projects
- Include both quantitative and qualitative benefits
- Focus on measurable impacts and success stories
- Organize by type of outcome or benefit

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a "value proposition" or "expected outcomes" section for a proposal.`;

    case ConsultantQueryType.GEOGRAPHIC:
      return `You are a proposal assistant summarizing geographic or regional experience.

RESPONSE FOCUS:
- Consolidate experience in the specified geography
- Include understanding of regional factors and considerations
- Highlight local expertise and cultural awareness
- Include relevant client examples from the region

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a "regional experience" section for a proposal.`;

    default:
      return `You are a proposal assistant helping to find relevant project examples and context.

RESPONSE FOCUS:
- Identify projects relevant to the query
- Include sufficient context for proposal writing
- Organize information clearly and professionally
- Focus on reusable information for proposal development

CONTENT FORMATTING:
${formatInstructions}

${commonRules}

Answer as if preparing a reference document for proposal writers.`;
  }
}

// Export query type detection for use in other modules
export { detectConsultantQueryType };

// Answer questions about historical proposals using the consultant query framework
export async function answerQuestion(
  question: string,
  chunks: ProposalChunk[],
  formatInstructions?: string
): Promise<string> {
  try {
    // Detect the type of consultant query
    const queryType = detectConsultantQueryType(question);
    
    // Get appropriate format instructions
    const defaultFormatInstructions = getFormatInstructions(queryType);
    const formatToUse = formatInstructions || defaultFormatInstructions;
    
    // Get appropriate system prompt
    const systemPrompt = getSystemPrompt(queryType, formatToUse);
    
    // Prepare context text
    const contextText = chunks.map(chunk => 
      `Client: ${chunk.metadata.client}\nFilename: ${chunk.metadata.filename}\nContent: ${chunk.content}`
    ).join('\n---\n');

    // Create user prompt based on query type
    const userPrompt = `Question: ${question}

Historical Proposal Data:
${contextText}

Query Type: ${queryType.toUpperCase()}

${queryType === ConsultantQueryType.METHODOLOGY ? 
  'SYNTHESIS TASK: Analyze the above historical data to identify common patterns, methodologies, and approaches. Extract what we consistently do across projects to create a unified methodology.' :
  'ANALYSIS TASK: Extract relevant information from the historical data to answer the consultant\'s question.'
}

${queryType === ConsultantQueryType.PROJECT_LIST ? 
  'IMPORTANT: This is a project list query - provide a comprehensive list of all relevant projects.' :
  'IMPORTANT: Focus on providing consolidated, reusable information for proposal writing.'
}

${formatInstructions ? `\nCustom Format Requirements: ${formatInstructions}` : ''}

Answer the question based on this data, following the format requirements above.`;

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    });

    const response = chatCompletion.choices[0].message?.content || '';
    
    // Add helpful closing note for certain query types
    if ([ConsultantQueryType.PROPOSAL_LANGUAGE, ConsultantQueryType.DELIVERABLES].includes(queryType)) {
      return response + '\n\n*If you\'d like, I can also link to detailed proposal sections or past documents.*';
    }
    
    return response;
  } catch (error) {
    console.error('Error answering question:', error);
    throw error;
  }
} 