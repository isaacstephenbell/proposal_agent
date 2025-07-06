import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExternalResearchRequest {
  query: string;
  includeWebSearch?: boolean;
  searchMode?: 'llm-only' | 'web-only' | 'both';
}

interface ResearchResult {
  id: string;
  type: 'llm' | 'web';
  source: string;
  title: string;
  content: string;
  url?: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const { query, includeWebSearch = false, searchMode = 'llm-only' }: ExternalResearchRequest = await request.json();

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const results: ResearchResult[] = [];

    // GPT-4 Research (No RAG context - purely external)
    if (searchMode === 'llm-only' || searchMode === 'both') {
      try {
        const llmResult = await getLLMResearch(query);
        results.push(llmResult);
      } catch (error) {
        console.error('Error getting LLM research:', error);
      }
    }

    // Web Search Research (Optional)
    if ((searchMode === 'web-only' || searchMode === 'both') && includeWebSearch) {
      try {
        const webResults = await getWebSearchResults(query);
        results.push(...webResults);
      } catch (error) {
        console.error('Error getting web search results:', error);
      }
    }

    return NextResponse.json({
      query,
      results,
      timestamp: new Date().toISOString(),
      mode: searchMode,
      total: results.length
    });

  } catch (error) {
    console.error('Error in external research API:', error);
    return NextResponse.json(
      { error: 'Failed to perform external research' },
      { status: 500 }
    );
  }
}

async function getLLMResearch(query: string): Promise<ResearchResult> {
  const systemPrompt = `You are a research assistant providing external information for business proposals. 
  
IMPORTANT: You are NOT accessing any internal proposal database or company-specific information. 
Provide general, publicly available information from your training data.

Focus on:
- Industry trends and benchmarks
- Market analysis and competitive landscape
- Best practices and methodologies
- Regulatory or compliance considerations
- Technology trends and innovations

Be comprehensive but concise. Provide actionable insights that could be relevant for business proposals.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const content = completion.choices[0].message.content || '';

  return {
    id: `llm-${Date.now()}`,
    type: 'llm',
    source: 'GPT-4',
    title: `AI Research: ${query.slice(0, 60)}${query.length > 60 ? '...' : ''}`,
    content,
    timestamp: new Date().toISOString()
  };
}

async function getWebSearchResults(query: string): Promise<ResearchResult[]> {
  // Check if SerpAPI key is available
  const serpApiKey = process.env.SERP_API_KEY;
  
  if (!serpApiKey) {
    // Fallback to mock web search results if no API key
    return getMockWebSearchResults(query);
  }

  try {
    const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=5`);
    
    if (!response.ok) {
      throw new Error('SerpAPI request failed');
    }

    const data = await response.json();
    const results: ResearchResult[] = [];

    // Process organic results
    if (data.organic_results) {
      data.organic_results.slice(0, 3).forEach((result: any, index: number) => {
        results.push({
          id: `web-${Date.now()}-${index}`,
          type: 'web',
          source: new URL(result.link).hostname,
          title: result.title,
          content: result.snippet || 'No description available',
          url: result.link,
          timestamp: new Date().toISOString()
        });
      });
    }

    // Process featured snippet if available
    if (data.answer_box) {
      results.unshift({
        id: `featured-${Date.now()}`,
        type: 'web',
        source: 'Featured Result',
        title: data.answer_box.title || 'Featured Answer',
        content: data.answer_box.answer || data.answer_box.snippet || '',
        url: data.answer_box.link,
        timestamp: new Date().toISOString()
      });
    }

    return results;

  } catch (error) {
    console.error('Error with SerpAPI:', error);
    return getMockWebSearchResults(query);
  }
}

function getMockWebSearchResults(query: string): ResearchResult[] {
  // Mock web search results for development/demo purposes
  return [
    {
      id: `mock-web-${Date.now()}`,
      type: 'web',
      source: 'example-industry-report.com',
      title: `Market Research: ${query}`,
      content: `This is a mock web search result for "${query}". In a production environment, this would be replaced with real web search results from SerpAPI or similar service. The content would include relevant industry insights, market data, and competitive analysis.`,
      url: 'https://example-industry-report.com/research',
      timestamp: new Date().toISOString()
    },
    {
      id: `mock-web-${Date.now()}-2`,
      type: 'web',
      source: 'business-insights.com',
      title: `Industry Trends: ${query}`,
      content: `Mock result showing industry trends and benchmarks related to "${query}". This would typically include statistical data, market forecasts, and competitive landscape analysis from external sources.`,
      url: 'https://business-insights.com/trends',
      timestamp: new Date().toISOString()
    }
  ];
} 