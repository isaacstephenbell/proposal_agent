import { createClient } from '@supabase/supabase-js';
import { ProposalChunk } from './types';

// Load environment variables if running in Node.js (not browser)
if (typeof window === 'undefined') {
  require('dotenv').config({ path: '.env.local' });
}

// Check for both CLI and Next.js environment variable formats
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side Supabase client (for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (for API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Vector search function using pgvector
export async function searchSimilarProposals(
  embedding: number[],
  limit: number = 5,
  filters?: {
    author?: string;
    sector?: string;
    client?: string;
    tags?: string[];
  }
): Promise<ProposalChunk[]> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('match_proposals', {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: limit,
        filter_author: filters?.author || null,
        filter_sector: filters?.sector || null,
        filter_client: filters?.client || null,
        filter_tags: filters?.tags || null
      });

    if (error) {
      console.error('Error searching proposals:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchSimilarProposals:', error);
    throw error;
  }
}

// Insert proposal chunk with embedding
export async function insertProposalChunk(
  content: string,
  embedding: number[],
  metadata: {
    filename: string;
    client: string;
    date?: string;
    tags?: string[];
    author?: string;
    sector?: string;
    file_hash?: string;
  }
): Promise<{ success: boolean; error?: any }> {
  try {
    // Handle date conversion safely
    let proposalDate = null;
    if (metadata.date) {
      try {
        const date = new Date(metadata.date);
        if (!isNaN(date.getTime())) {
          proposalDate = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn(`Invalid date format: ${metadata.date}`);
      }
    }

    const { error } = await supabaseAdmin
      .from('proposals')
      .insert({
        content,
        embedding,
        metadata,
        author: metadata.author || null,
        sector: metadata.sector || null,
        proposal_date: proposalDate,
        filename: metadata.filename || null,
        client: metadata.client || null,
        file_hash: metadata.file_hash || null,
        tags: metadata.tags || null
      });

    if (error) {
      console.error('Error inserting proposal chunk:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in insertProposalChunk:', error);
    return { success: false, error };
  }
}

// Get all proposals (for debugging/testing)
export async function getAllProposals(): Promise<ProposalChunk[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching proposals:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllProposals:', error);
    throw error;
  }
} 