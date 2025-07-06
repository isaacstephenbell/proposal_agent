'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BlockBrowser from '@/components/BlockBrowser';

interface Block {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  usage_count: number;
  author: string;
  client?: string;
  sector?: string;
}

export default function BlocksManagement() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'usage' | 'title'>('created');
  const [filterTag, setFilterTag] = useState('');
  const [isShowingBrowser, setIsShowingBrowser] = useState(false);

  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    try {
      const response = await fetch('/api/blocks');
      if (!response.ok) throw new Error('Failed to load blocks');
      const data = await response.json();
      setBlocks(data.blocks || []);
    } catch (error) {
      console.error('Error loading blocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('Are you sure you want to delete this block?')) return;

    try {
      const response = await fetch(`/api/blocks/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete block');
      
      setBlocks(blocks.filter(block => block.id !== id));
    } catch (error) {
      console.error('Error deleting block:', error);
    }
  };

  const handleEditBlock = (block: Block) => {
    // In a real app, this would open an edit modal
    console.log('Edit block:', block);
  };

  const getAllTags = () => {
    const tags = new Set<string>();
    blocks.forEach(block => {
      block.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  };

  const getFilteredBlocks = () => {
    return blocks
      .filter(block => {
        const matchesSearch = !searchTerm || 
          block.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          block.content.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesTag = !filterTag || block.tags.includes(filterTag);
        
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'usage':
            return b.usage_count - a.usage_count;
          case 'title':
            return a.title.localeCompare(b.title);
          case 'created':
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  };

  const getStatusColor = (usageCount: number) => {
    if (usageCount === 0) return 'bg-gray-100 text-gray-600';
    if (usageCount < 5) return 'bg-yellow-100 text-yellow-600';
    if (usageCount < 10) return 'bg-green-100 text-green-600';
    return 'bg-blue-100 text-blue-600';
  };

  const getStatusText = (usageCount: number) => {
    if (usageCount === 0) return 'Unused';
    if (usageCount < 5) return 'Rarely used';
    if (usageCount < 10) return 'Popular';
    return 'Frequently used';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">📚 Block Library</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsShowingBrowser(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Browse & Insert
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search blocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created">Sort by Date</option>
              <option value="usage">Sort by Usage</option>
              <option value="title">Sort by Title</option>
            </select>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Tags</option>
              {getAllTags().map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{blocks.length}</div>
            <div className="text-sm text-gray-600">Total Blocks</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{blocks.filter(b => b.usage_count > 0).length}</div>
            <div className="text-sm text-gray-600">Used Blocks</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{getAllTags().length}</div>
            <div className="text-sm text-gray-600">Unique Tags</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{blocks.reduce((sum, b) => sum + b.usage_count, 0)}</div>
            <div className="text-sm text-gray-600">Total Usage</div>
          </div>
        </div>

        {/* Blocks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {getFilteredBlocks().map((block) => (
            <div key={block.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{block.title}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditBlock(block)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {block.content.substring(0, 200)}...
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {block.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                    {tag}
                  </span>
                ))}
                {block.tags.length > 3 && (
                  <span className="text-gray-400 text-xs">+{block.tags.length - 3} more</span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(block.usage_count)}`}>
                    {getStatusText(block.usage_count)}
                  </span>
                  <span className="text-gray-500">Used {block.usage_count} times</span>
                </div>
                <div className="text-gray-500">
                  {new Date(block.created_at).toLocaleDateString()}
                </div>
              </div>

              {block.client && (
                <div className="mt-2 text-xs text-gray-500">
                  Client: {block.client} {block.sector && `• ${block.sector}`}
                </div>
              )}
            </div>
          ))}
        </div>

        {getFilteredBlocks().length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No blocks found</h3>
            <p className="text-gray-500">
              {searchTerm || filterTag ? 'Try adjusting your search or filter.' : 'Start saving content sections as blocks to build your library.'}
            </p>
          </div>
        )}
      </main>

      {/* Block Browser Modal */}
      {isShowingBrowser && (
        <BlockBrowser
          isOpen={isShowingBrowser}
          onClose={() => setIsShowingBrowser(false)}
          onInsertBlock={(content) => {
            // In the context of blocks management, we could copy to clipboard or show a success message
            navigator.clipboard.writeText(content);
            setIsShowingBrowser(false);
          }}
        />
      )}
    </div>
  );
} 