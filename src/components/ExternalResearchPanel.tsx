'use client';

import { useState, useRef, useEffect } from 'react';

interface ResearchResult {
  id: string;
  type: 'llm' | 'web';
  source: string;
  title: string;
  content: string;
  url?: string;
  timestamp: string;
}

interface ExternalResearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyToProposal: (content: string, source: string, query: string) => void;
}

export default function ExternalResearchPanel({ isOpen, onClose, onCopyToProposal }: ExternalResearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'llm-only' | 'web-only' | 'both'>('llm-only');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/external-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          includeWebSearch: searchMode === 'web-only' || searchMode === 'both',
          searchMode
        })
      });

      if (!response.ok) {
        throw new Error('Research request failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      
      // Add to search history
      if (!searchHistory.includes(query.trim())) {
        setSearchHistory(prev => [query.trim(), ...prev.slice(0, 4)]);
      }
      
    } catch (error) {
      console.error('Error performing external research:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToProposal = (result: ResearchResult) => {
    const sourceInfo = result.type === 'llm' 
      ? `GPT-4 Research` 
      : `Web Search: ${result.source}`;
    
    onCopyToProposal(result.content, sourceInfo, query);
  };

  const handleSummarize = async (result: ResearchResult) => {
    try {
      const response = await fetch('/api/external-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Please summarize this content in 2-3 sentences: ${result.content}`,
          searchMode: 'llm-only'
        })
      });

      if (!response.ok) throw new Error('Summarization failed');

      const data = await response.json();
      const summary = data.results?.[0]?.content || 'Unable to summarize';
      
      onCopyToProposal(summary, `Summary of ${result.source}`, query);
    } catch (error) {
      console.error('Error summarizing:', error);
    }
  };

  const getResultIcon = (type: string) => {
    return type === 'llm' ? '🤖' : '🌐';
  };

  const getResultBadgeColor = (type: string) => {
    return type === 'llm' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">External Research Mode — Powered by GPT & Web Search</h2>
              <p className="text-orange-100 text-sm mt-1">
                ⚠️ External results — not from internal proposal data
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-orange-200 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Controls */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col space-y-3">
            {/* Search Mode Selection */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Search Mode:</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSearchMode('llm-only')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    searchMode === 'llm-only' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🤖 LLM Only
                </button>
                <button
                  onClick={() => setSearchMode('web-only')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    searchMode === 'web-only' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🌐 Web Only
                </button>
                <button
                  onClick={() => setSearchMode('both')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    searchMode === 'both' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🔍 Both
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for industry trends, market data, best practices, competitor analysis..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  isLoading || !query.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">Recent:</span>
                {searchHistory.map((pastQuery, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(pastQuery)}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {pastQuery.length > 30 ? `${pastQuery.slice(0, 30)}...` : pastQuery}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Searching external sources...</span>
            </div>
          )}

          {results.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Research</h3>
              <p className="text-gray-500">
                Enter a query to search external sources for market insights, industry trends, and competitive analysis.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getResultIcon(result.type)}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{result.title}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getResultBadgeColor(result.type)}`}>
                            {result.type === 'llm' ? 'Powered by GPT-4' : `Live Web Search Result from ${result.source}`}
                          </span>
                          {result.url && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 text-xs"
                            >
                              View Source →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-gray-700 text-sm mb-4 leading-relaxed">
                    {result.content}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCopyToProposal(result)}
                      className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 text-sm font-medium transition-colors"
                    >
                      📋 Copy to Proposal (Mark as External Source)
                    </button>
                    <button
                      onClick={() => handleSummarize(result)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm font-medium transition-colors"
                    >
                      📝 Summarize This Result
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>⚠️ External sources only - no internal proposal data</span>
              <span>•</span>
              <span>{results.length} results found</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setResults([])}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear Results
              </button>
              <button
                onClick={onClose}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 