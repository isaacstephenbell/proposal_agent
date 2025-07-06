# 🔍 External Research Mode Guide

## Overview

External Research Mode is a powerful feature that allows users to search the web and query GPT-4 for information **outside** your internal proposal database. This enables users to gather external insights such as competitor data, market benchmarks, and industry trends directly within the Proposal Writer.

## ✅ Key Features

### 🔐 Complete Separation from Internal Data
- **No RAG integration** - Uses only external sources
- **No internal proposal data** used in responses
- **Clear visual separation** in UI with warning labels
- **Auto-tagged content** when copied to proposals

### 🌐 Multiple Search Modes
- **LLM Only**: Pure GPT-4 research without web search
- **Web Only**: Live web search results (requires SerpAPI)
- **Both**: Combined LLM and web search results

### 📋 Smart Copy Features
- **Auto-attribution** when copying to proposals
- **Summarization** of long results before copying
- **Formatted insertion** with clear external source marking

## 🚀 Getting Started

### 1. Environment Setup

Add the following to your `.env.local` file:

```bash
# Required for LLM research
OPENAI_API_KEY=your_openai_api_key_here

# Optional for web search functionality
SERP_API_KEY=your_serpapi_key_here
```

**Note**: Web search will work with mock data if no SerpAPI key is provided.

### 2. SerpAPI Setup (Optional)

1. Visit [https://serpapi.com/](https://serpapi.com/)
2. Sign up for a free account (100 searches/month)
3. Get your API key from the dashboard
4. Add it to your environment variables

### 3. Using External Research Mode

#### In Proposal Writer:
1. Click **"🔍 Search External Sources (Web & AI)"** in the left sidebar
2. Select your search mode (LLM Only, Web Only, or Both)
3. Enter your research query
4. Review results and copy relevant content to your proposal

#### Search Mode Options:
- **🤖 LLM Only**: Get AI-generated insights based on training data
- **🌐 Web Only**: Live web search results from current sources
- **🔍 Both**: Combination of AI insights and web search

## 📊 Technical Implementation

### API Endpoints

#### `/api/external-research`
- **Method**: POST
- **Purpose**: Handles external research queries
- **Parameters**:
  - `query`: Search query string
  - `includeWebSearch`: Boolean for web search inclusion
  - `searchMode`: 'llm-only' | 'web-only' | 'both'

### Component Architecture

#### `ExternalResearchPanel`
- **Location**: `src/components/ExternalResearchPanel.tsx`
- **Purpose**: Main UI component for external research
- **Features**:
  - Chat-style interface
  - Search mode selection
  - Results display with clear source attribution
  - Copy and summarize actions

#### Integration Points
- **Proposal Writer**: Main integration point
- **Discovery Chat**: Optional integration point
- **Block System**: Separate from external research

## 🎨 UI/UX Design

### Visual Separation
- **Orange/Red color scheme** to distinguish from internal features
- **Warning labels** on all external research interfaces
- **Clear attribution** in copied content
- **Distinct iconography** (🔍 for external, 📚 for internal)

### Content Formatting
When content is copied to proposals, it's automatically formatted as:

```markdown
---
**[External Research Source]**: GPT-4 Research
**Query**: market trends in workforce planning
**Date**: 12/15/2024
**Content**:
[Research content here]
---
```

## 🔄 User Flows

### Flow 1: Quick Research
1. User is writing a proposal
2. Needs external market data
3. Clicks "Search External Sources"
4. Searches for "workforce planning market trends"
5. Copies relevant insights to proposal

### Flow 2: Comprehensive Research
1. User opens External Research Mode
2. Conducts multiple searches on different topics
3. Summarizes long results
4. Copies multiple insights to proposal
5. Builds comprehensive external context

### Flow 3: Competitive Analysis
1. User researches competitors
2. Uses web search for current information
3. Combines with LLM insights
4. Creates competitive landscape section

## 📈 Benefits

### For Users
- **No context switching** between tools
- **Clear source attribution** for compliance
- **Smart summarization** of complex information
- **Integrated workflow** within proposal writing

### For Data Integrity
- **Complete separation** from internal data
- **No pollution** of internal knowledge base
- **Clear tracking** of external vs. internal sources
- **Audit trail** for all external research

## 🛠️ Configuration Options

### Search Modes
```typescript
type SearchMode = 'llm-only' | 'web-only' | 'both';
```

### Result Types
```typescript
interface ResearchResult {
  id: string;
  type: 'llm' | 'web';
  source: string;
  title: string;
  content: string;
  url?: string;
  timestamp: string;
}
```

## 🔧 Development Notes

### Adding External Research to Other Components

To add external research to any component:

1. Import the component:
```typescript
import ExternalResearchPanel from '@/components/ExternalResearchPanel';
```

2. Add state management:
```typescript
const [isShowingExternalResearch, setIsShowingExternalResearch] = useState(false);
```

3. Add the panel:
```tsx
<ExternalResearchPanel
  isOpen={isShowingExternalResearch}
  onClose={() => setIsShowingExternalResearch(false)}
  onCopyToProposal={handleCopyFromExternalResearch}
/>
```

### Customizing Search Behavior

The research API can be extended with additional parameters:

```typescript
interface ExternalResearchRequest {
  query: string;
  includeWebSearch?: boolean;
  searchMode?: 'llm-only' | 'web-only' | 'both';
  maxResults?: number;
  language?: string;
  region?: string;
}
```

## 🚨 Important Considerations

### Data Privacy
- **No internal data** is sent to external APIs
- **User queries** are sent to OpenAI and SerpAPI
- **Results are temporary** and not stored in database
- **Clear user consent** through warning labels

### API Limits
- **OpenAI**: Subject to your OpenAI API limits
- **SerpAPI**: Free tier includes 100 searches/month
- **Rate limiting**: Implement client-side throttling if needed

### Content Accuracy
- **External sources** may contain inaccurate information
- **User responsibility** to verify facts
- **Clear attribution** enables fact-checking
- **Timestamp tracking** for temporal relevance

## 📚 Examples

### Example Queries
- "workforce planning market trends 2024"
- "ERP migration best practices"
- "digital transformation benchmarks"
- "competitor analysis [industry]"
- "regulatory compliance requirements [sector]"

### Example Use Cases
- **Market Research**: Understanding industry trends
- **Competitive Analysis**: Researching competitors
- **Benchmarking**: Finding industry standards
- **Regulatory Research**: Understanding compliance requirements
- **Technology Trends**: Staying current with innovations

## 🔮 Future Enhancements

### Phase 1: Enhanced Search
- **Multiple search engines** (Bing, Google, DuckDuckGo)
- **Specialized sources** (academic papers, industry reports)
- **Image and video search** capabilities
- **Real-time news** integration

### Phase 2: Advanced Features
- **Research templates** for common queries
- **Collaborative research** with team members
- **Research history** and bookmarking
- **Automated fact-checking** against multiple sources

### Phase 3: Intelligence Layer
- **Query suggestions** based on proposal content
- **Trend analysis** across multiple searches
- **Competitive intelligence** dashboards
- **Custom research workflows**

## 🎯 Success Metrics

### Usage Metrics
- **Search frequency** per user
- **Mode preferences** (LLM vs Web vs Both)
- **Copy-to-proposal rate** 
- **Query complexity** and success rates

### Quality Metrics
- **User satisfaction** with results
- **Content utilization** in final proposals
- **Source diversity** in research
- **Accuracy feedback** from users

---

*External Research Mode empowers users to enrich their proposals with current, relevant external information while maintaining complete separation from internal data sources.* 