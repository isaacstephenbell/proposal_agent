export interface Proposal {
  id: number;
  content: string;
  metadata: {
    author?: string;
    sector?: string;
    date?: string;
    filename?: string;
    client?: string;
    file_hash?: string;
    tags?: string[];
    [key: string]: any;
  };
  // Separate columns for better querying
  author?: string;
  sector?: string;
  proposal_date?: string;
  filename?: string;
  client?: string;
  file_hash?: string;
  tags?: string[];
  created_at: string;
  similarity?: number;
}

export interface ProposalChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    filename: string;
    client: string;
    date?: string;
    tags?: string[];
    section?: 'understanding' | 'approach' | 'timeline' | 'problem';
    author?: string;
    sector?: string;
    clientType?: string;
    file_hash?: string;
  };
  author?: string;
  sector?: string;
  clientType?: string;
  proposal_date?: string;
  created_at: string;
}

export interface ProposalMetadata {
  filename: string;
  client: string;
  date?: string;
  tags?: string[];
  author?: string;
  sector?: string;
  clientType?: string;
  file_hash?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    client: string;
    filename: string;
    content: string;
    date?: string;
    author?: string;
    sector?: string;
  }>;
}

export interface GeneratedProposal {
  proposal: string;
  sources: Array<{
    client: string;
    filename: string;
    content: string;
  }>;
}

// Enhanced with context tracking
export interface ConversationContext {
  conversationHistory: Array<{
    query: string;
    response: string;
    entities: string[]; // [Mo'Bettahs, Crux Capital, etc.]
    queryType: string;
    resultChunks: string[];
    timestamp: Date;
  }>;
  activeEntities: {
    currentClient?: string;
    currentProject?: string;
    currentSector?: string;
    discussedClients: string[];
    discussedProjects: string[];
  };
  lastSuccessfulResults?: Array<{
    id: string;
    filename: string;
    client: string;
    content: string;
  }>;
  conversationTurn: number;
  // Legacy fields for backward compatibility
  lastClient?: string;
  lastSector?: string;
  lastQuery?: string;
}

export interface AppliedFilters {
  client?: string;
  sector?: string;
  author?: string;
  dateRange?: string;
  contextSource?: 'explicit' | 'followup' | 'topic-followup' | 'topic-continuation' | 'client-followup' | 'followup-no-context' | 'none';
  queryEnhancement?: string;
}

export interface DuplicateInfo {
  filename: string;
  similarity: number;
  reason: string;
}

export interface CorrectionFeedback {
  sourceId: string;
  field: 'client' | 'author' | 'sector' | 'date';
  oldValue: string;
  newValue: string;
  context: string;
}

export interface AskResponse {
  answer: string;
  sources: Array<{
    client: string;
    filename: string;
    content: string;
    date?: string;
    author?: string;
    sector?: string;
    snippet?: string;
    confidence?: {
      client: number;
      author: number;
      sector: number;
      date: number;
    };
    duplicates?: DuplicateInfo[];
    qualityScore?: number;
    crossEncoderScore?: number;
  }>;
  context?: ConversationContext;
  appliedFilters?: AppliedFilters;
  suggestions?: string[];
  duplicateWarnings?: DuplicateInfo[];
  // For feedback system
  chunk_ids?: string[];
  query_type?: string;
  // For performance monitoring
  searchMetadata?: {
    queryExpansion?: {
      originalQuery: string;
      expandedQuery: string;
      synonyms: string[];
      relatedTerms: string[];
    };
    stageResults?: {
      semantic: number;
      reranked: number;
      diversified: number;
    };
    processingTime?: number;
    searchStrategy?: string;
  };
}

export interface GenerateRequest {
  problem: string;
  client?: string;
}

export interface AskRequest {
  query: string;
  context?: ConversationContext;
}

// Thought Partner types
export interface ProposalBrief {
  goals: string[];
  customGoal?: string;
  audience: string[];
  customAudience?: string;
  challenges: string;
  references: Array<{
    filename: string;
    client: string;
    relevance: string;
  }>;
  timeline?: string;
  budget?: string;
}

export interface ThoughtPartnerStep {
  step: number;
  question: string;
  type: 'multiple-choice' | 'text' | 'recommendations' | 'summary';
  options?: string[];
  allowCustom?: boolean;
  allowMultiple?: boolean;
}

export interface ThoughtPartnerState {
  currentStep: number;
  brief: Partial<ProposalBrief>;
  isComplete: boolean;
}

// Proposal Blocks types
export interface ProposalBlock {
  id: string;
  title: string;
  content: string;
  tags: string[];
  author_id: string;
  created_at: string;
  last_used_at: string;
  usage_count: number;
  notes?: string;
  similarity?: number;
}

export interface CreateBlockRequest {
  title: string;
  content: string;
  tags?: string[];
  author_id: string;
  notes?: string;
}

export interface UpdateBlockRequest {
  title?: string;
  content?: string;
  tags?: string[];
  notes?: string;
}

export interface BlockSearchRequest {
  query?: string;
  tags?: string[];
  author_id?: string;
  limit?: number;
  sort?: 'recent' | 'popular' | 'last_used';
}

export interface BlockSuggestionRequest {
  context: string; // The current proposal context
  client?: string;
  sector?: string;
  tags?: string[];
  excludeBlockIds?: string[];
  limit?: number;
}

// Discovery Chat Feedback System
export interface DiscoveryFeedback {
  id?: string;
  question: string;
  answer: string;
  rating: 'good' | 'bad';
  feedback_reason?: string; // Why was it good/bad?
  chunk_ids: string[];
  query_type?: string;
  applied_filters?: AppliedFilters;
  user_id?: string;
  session_id?: string;
  created_at?: string;
}

export interface FeedbackRequest {
  question: string;
  answer: string;
  rating: 'good' | 'bad';
  feedback_reason?: string; // Why was it good/bad?
  chunk_ids: string[];
  query_type?: string;
  applied_filters?: AppliedFilters;
  session_id?: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: string;
  feedback_id?: string;
}