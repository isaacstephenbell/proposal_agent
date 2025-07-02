import OpenAI from 'openai';

const openai = new OpenAI();

export interface DocumentAnalysis {
  sector: string;
  tags: string[];
}

export async function generateDocumentAnalysis(content: string): Promise<DocumentAnalysis> {
  try {
    // Take the first 4000 characters for analysis (to stay within token limits)
    const contentPreview = content.substring(0, 4000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a proposal analysis expert. Analyze the proposal content and provide:

1. SECTOR CLASSIFICATION: Classify the document into a single sector from these options:
- private-equity
- foundations  
- education
- healthcare
- manufacturing
- retail
- technology
- consulting
- government
- non-profit
- financial-services
- real-estate
- energy
- transportation
- other

2. TAGS: Generate 3-6 relevant tags that would help categorize and search for this proposal.

Focus on:
- Industry/sector (e.g., healthcare, manufacturing, retail)
- Service type (e.g., consulting, implementation, training)
- Technology/approach (e.g., digital-transformation, process-optimization)
- Business function (e.g., operations, marketing, finance)
- Project scope (e.g., strategy, execution, maintenance)

Return your response in this exact JSON format:
{
  "sector": "sector-name",
  "tags": ["tag1", "tag2", "tag3"]
}

Use lowercase, kebab-case format for both sector and tags.`
        },
        {
          role: "user",
          content: `Analyze this proposal content:\n\n${contentPreview}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    if (!responseText) {
      return { sector: 'other', tags: [] };
    }

    try {
      // Parse the JSON response
      const analysis = JSON.parse(responseText);
      
      // Validate and clean the response
      const sector = analysis.sector || 'other';
      const tags = Array.isArray(analysis.tags) 
        ? analysis.tags
            .map((tag: any) => tag.trim().toLowerCase().replace(/\s+/g, '-'))
            .filter((tag: string) => tag.length > 0)
        : [];

      return { sector, tags };
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      return { sector: 'other', tags: [] };
    }
  } catch (error) {
    console.error('Error generating document analysis:', error);
    return { sector: 'other', tags: [] };
  }
}

// Keep the old function for backward compatibility
export async function generateAutoTags(content: string): Promise<string[]> {
  const analysis = await generateDocumentAnalysis(content);
  return analysis.tags;
} 