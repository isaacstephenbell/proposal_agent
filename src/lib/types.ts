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
  lastClient?: string;
  lastSector?: string;
  lastQuery?: string;
}

export interface AppliedFilters {
  client?: string;
  sector?: string;
  author?: string;
  dateRange?: string;
  contextSource?: 'explicit' | 'followup' | 'none';
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
  }>;
  context?: ConversationContext;
  appliedFilters?: AppliedFilters;
  suggestions?: string[];
  duplicateWarnings?: DuplicateInfo[];
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