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

export interface AskResponse {
  answer: string;
  sources: Array<{
    client: string;
    filename: string;
    content: string;
  }>;
}

export interface GenerateRequest {
  problem: string;
  client?: string;
}

export interface AskRequest {
  query: string;
} 