'use client';

import { useState, useEffect } from 'react';
import { ProposalBlock } from '@/lib/types';

interface SuggestedBlocksProps {
  context: string;
  client?: string;
  sector?: string;
  onSelectBlock: (block: ProposalBlock) => void;
  isVisible: boolean;
}

export default function SuggestedBlocks({
  context,
  client,
  sector,
  onSelectBlock,
  isVisible
}: SuggestedBlocksProps) {
  const [suggestedBlocks, setSuggestedBlocks] = useState<ProposalBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    if (!context || context.length < 50) return; // Don't suggest for very short context

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/blocks/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          client,
          sector,
          limit: 5
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuggestedBlocks(data.suggestedBlocks || []);
      } else {
        setError(data.error || 'Failed to fetch suggestions');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setError('Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && context) {
      // Debounce the suggestions API call
      const timeoutId = setTimeout(fetchSuggestions, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [context, client, sector, isVisible]);

  const handleBlockSelect = async (block: ProposalBlock) => {
    // Track usage
    try {
      await fetch('/api/blocks/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockId: block.id }),
      });
    } catch (error) {
      console.error('Error tracking block usage:', error);
    }

    onSelectBlock(block);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white border-l border-gray-200 w-80 flex flex-col h-full">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">Suggested Blocks</h3>
        <p className="text-sm text-gray-600">
          Reusable sections that might be relevant for this proposal
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Finding relevant blocks...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : suggestedBlocks.length === 0 ? (
          <div className="text-center py-8">
            <div className="mb-2">
              <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              No relevant blocks found for this content. 
              {context.length < 50 && " Add more content to get suggestions."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-4">
              {client && `Found blocks relevant to ${client} and similar projects.`}
              {!client && 'Found blocks relevant to similar projects.'}
            </p>
            
            {suggestedBlocks.map((block) => (
              <div
                key={block.id}
                className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleBlockSelect(block)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm text-gray-800 leading-tight">
                    {block.title}
                  </h4>
                  {block.usage_count > 0 && (
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      Used {block.usage_count}x
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                  {truncateText(block.content)}
                </p>
                
                {block.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {block.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {block.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{block.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBlockSelect(block);
                  }}
                  className="w-full bg-blue-500 text-white text-xs py-1.5 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  Insert Block
                </button>
                
                {block.similarity && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Relevance:</span>
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-1 mr-2">
                          <div 
                            className="bg-blue-500 h-1 rounded-full"
                            style={{ width: `${Math.round((block.similarity || 0) * 100)}%` }}
                          ></div>
                        </div>
                        <span>{Math.round((block.similarity || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {suggestedBlocks.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-600">
            💡 Tip: These blocks were automatically selected based on your proposal content and past usage patterns.
          </p>
        </div>
      )}
    </div>
  );
} 