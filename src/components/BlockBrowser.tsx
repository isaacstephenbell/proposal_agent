'use client';

import { useState, useEffect } from 'react';
import { ProposalBlock } from '@/lib/types';

interface BlockBrowserProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectBlock: (block: ProposalBlock) => void;
  authorId?: string;
}

export default function BlockBrowser({ 
  isVisible, 
  onClose, 
  onSelectBlock, 
  authorId 
}: BlockBrowserProps) {
  const [blocks, setBlocks] = useState<ProposalBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'last_used'>('recent');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        sort: sortBy
      });
      
      if (searchQuery) params.append('query', searchQuery);
      if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));
      if (authorId) params.append('author', authorId);

      const response = await fetch(`/api/blocks?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setBlocks(data.blocks);
        // Extract unique tags from blocks
        const allTags = data.blocks.flatMap((block: ProposalBlock) => block.tags);
        setAvailableTags(Array.from(new Set(allTags)));
      } else {
        console.error('Error fetching blocks:', data.error);
      }
    } catch (error) {
      console.error('Error fetching blocks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchBlocks();
    }
  }, [isVisible, searchQuery, selectedTags, sortBy, authorId]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleBlockSelect = (block: ProposalBlock) => {
    onSelectBlock(block);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Browse Proposal Blocks</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search and filters */}
          <div className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blocks by title or content..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'last_used')}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="recent">Most Recent</option>
                  <option value="popular">Most Popular</option>
                  <option value="last_used">Recently Used</option>
                </select>
              </div>
            </div>

            {/* Tag filters */}
            {availableTags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Filter by tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 10).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedTags.includes(tag)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Block list */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading blocks...</p>
            </div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No blocks found matching your criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleBlockSelect(block)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{block.title}</h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>Used {block.usage_count} times</span>
                      <span>•</span>
                      <span>Created {formatDate(block.created_at)}</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-3">
                    {truncateContent(block.content)}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap gap-1">
                      {block.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBlockSelect(block);
                      }}
                      className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Insert Block
                    </button>
                  </div>
                  
                  {block.notes && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-sm text-gray-500 italic">
                        Note: {block.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 