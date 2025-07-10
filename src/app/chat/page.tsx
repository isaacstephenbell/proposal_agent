'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    client: string;
    filename: string;
    content: string;
    author?: string;
    sector?: string;
    tags?: string[];
    similarity?: number;
  }>;
  context?: {
    lastClient?: string;
    lastQuery?: string;
    lastSector?: string;
  };
  appliedFilters?: {
    client?: string;
    contextSource?: string;
    queryEnhancement?: string;
  };
  suggestions?: string[];
  // For feedback system
  chunk_ids?: string[];
  query_type?: string;
  original_question?: string; // The user question that generated this response
  feedback_given?: 'good' | 'bad' | null;
}

// Function to format message content with proper structure
function formatMessageContent(content: string) {
  // Split content into lines for processing
  const lines = content.split('\n');
  const formattedElements: JSX.Element[] = [];
  let currentList: JSX.Element[] = [];
  let listType: 'numbered' | 'bullet' | null = null;
  let currentParagraph: string[] = [];

  const finishCurrentList = () => {
    if (currentList.length > 0) {
      if (listType === 'numbered') {
        formattedElements.push(
          <ol key={formattedElements.length} className="list-decimal list-inside space-y-3 my-4 ml-6 bg-gray-50 p-4 rounded-lg">
            {currentList}
          </ol>
        );
      } else if (listType === 'bullet') {
        formattedElements.push(
          <ul key={formattedElements.length} className="list-disc list-inside space-y-3 my-4 ml-6 bg-blue-50 p-4 rounded-lg">
            {currentList}
          </ul>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  const finishCurrentParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraphText = currentParagraph.join(' ').trim();
      if (paragraphText) {
        formattedElements.push(
          <p key={formattedElements.length} className="mb-4 leading-relaxed">
            {formatInlineText(paragraphText)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      finishCurrentList();
      finishCurrentParagraph();
      return;
    }

    // Check for numbered list items (1. 2. 3.)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      finishCurrentParagraph();
      if (listType !== 'numbered') {
        finishCurrentList();
        listType = 'numbered';
      }
      currentList.push(
        <li key={currentList.length} className="text-sm leading-relaxed py-1 pl-2">
          {formatInlineText(numberedMatch[2])}
        </li>
      );
      return;
    }

    // Check for bullet points (• or -)
    const bulletMatch = trimmedLine.match(/^[•\-]\s(.+)/);
    if (bulletMatch) {
      finishCurrentParagraph();
      if (listType !== 'bullet') {
        finishCurrentList();
        listType = 'bullet';
      }
      currentList.push(
        <li key={currentList.length} className="text-sm leading-relaxed py-1 pl-2">
          {formatInlineText(bulletMatch[1])}
        </li>
      );
      return;
    }

    // Regular paragraph text
    finishCurrentList();
    currentParagraph.push(trimmedLine);
  });

  // Finish any remaining content
  finishCurrentList();
  finishCurrentParagraph();

  return formattedElements.length > 0 ? formattedElements : [<p key={0}>{formatInlineText(content)}</p>];
}

// Function to format inline text (bold, etc.)
function formatInlineText(text: string): JSX.Element[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default function DiscoveryChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentContext, setCurrentContext] = useState<any>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<{[key: number]: boolean}>({});
  const [feedbackModal, setFeedbackModal] = useState<{messageIndex: number, rating: 'good' | 'bad'} | null>(null);
  const [feedbackReason, setFeedbackReason] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const exampleQuestions = [
    "What work have we done for MGT?",
    "Show me our PowerParts projects in chronological order",
    "What consulting work have we done in the private equity sector?",
    "Give me a brief summary of our workforce planning projects",
    "What talent development solutions have we provided in detailed format?",
    "Tell me about our social impact projects using bullet points",
  ];

  const formatOptions = [
    { label: "Default", description: "Problem → Solution format" },
    { label: "Brief", description: "Concise summaries" },
    { label: "Detailed", description: "Comprehensive information" },
    { label: "Chronological", description: "Ordered by date" },
    { label: "Bullet Points", description: "All bullet format" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMessage,
          context: currentContext
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage = {
          role: 'assistant' as const,
          content: data.answer,
          sources: data.sources,
          context: data.context,
          appliedFilters: data.appliedFilters,
          suggestions: data.suggestions,
          // For feedback system
          chunk_ids: data.chunk_ids,
          query_type: data.query_type,
          original_question: userMessage,
          feedback_given: null
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setCurrentContext(data.context || {});
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (question: string) => {
    setInput(question);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const toggleSources = (messageIndex: number) => {
    setExpandedSources(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }));
  };

  const handleFeedback = async (messageIndex: number, rating: 'good' | 'bad') => {
    // For "good" ratings, submit immediately
    if (rating === 'good') {
      await submitFeedback(messageIndex, rating);
    } else {
      // For "bad" ratings, show modal to capture reason
      setFeedbackModal({ messageIndex, rating });
    }
  };

  const submitFeedback = async (messageIndex: number, rating: 'good' | 'bad', reason?: string) => {
    const message = messages[messageIndex];
    if (message.role !== 'assistant' || message.chunk_ids === undefined || !message.original_question) {
      console.error('Cannot submit feedback: missing required data');
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: message.original_question,
          answer: message.content,
          rating,
          feedback_reason: reason,
          chunk_ids: message.chunk_ids,
          query_type: message.query_type,
          applied_filters: message.appliedFilters,
          session_id: 'anonymous' // TODO: Generate proper session ID
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update message to show feedback was given
        setMessages(prev => prev.map((msg, idx) => 
          idx === messageIndex 
            ? { ...msg, feedback_given: rating }
            : msg
        ));
        console.log('✅ Feedback submitted successfully:', data.feedback_id);
        
        // Close modal and reset reason
        setFeedbackModal(null);
        setFeedbackReason('');
      } else {
        console.error('Failed to submit feedback:', data.error);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };



  const startWriting = () => {
    router.push('/writer');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-xl font-semibold text-gray-900">💬 Discovery Chat</h1>
          <p className="text-sm text-gray-600 mt-1">Explore your proposal history</p>
        </div>

        <div className="p-4 flex-1">
          <h3 className="font-medium text-gray-900 mb-3">Format Options</h3>
          <div className="space-y-1 mb-4">
            {formatOptions.map((option, index) => (
              <div key={index} className="text-xs text-gray-600 flex justify-between">
                <span className="font-medium">{option.label}:</span>
                <span>{option.description}</span>
              </div>
            ))}
          </div>
          
          <h3 className="font-medium text-gray-900 mb-3">Example Questions</h3>
          <div className="space-y-2">
            {exampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(question)}
                className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={startWriting}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm font-medium"
          >
            Start Writing Proposal →
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ask me anything about your proposal history</h2>
            <p className="text-sm text-gray-600">I can help you find past work, understand what's been successful, and inform your new proposals.</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to explore your proposals</h3>
              <p className="text-gray-500 mb-4">
                Ask me about past work, successful approaches, or anything that might help with your new proposal.
              </p>
              <p className="text-sm text-gray-400">
                Try one of the example questions from the sidebar, or ask your own question.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'} rounded-lg p-4`}>
                  
                  {/* Applied Filters Badge */}
                  {message.appliedFilters && message.appliedFilters.contextSource !== 'none' && (
                    <div className="mb-2 flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Applied:</span>
                      {message.appliedFilters.client && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          Client: {message.appliedFilters.client}
                        </span>
                      )}
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        {message.appliedFilters.contextSource === 'explicit' ? 'Explicit' : 'Follow-up'}
                      </span>
                    </div>
                  )}

                  <div className="text-sm mb-2">
                    {message.role === 'assistant' ? formatMessageContent(message.content) : message.content}
                  </div>
                  
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          Sources ({message.sources.length})
                        </h4>
                        <button
                          onClick={() => toggleSources(index)}
                          className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          <span className="mr-1">
                            {expandedSources[index] ? 'Hide' : 'Show'}
                          </span>
                          <svg 
                            className={`w-4 h-4 transition-transform ${expandedSources[index] ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {expandedSources[index] && (
                        <div className="space-y-2">
                          {message.sources.map((source, sourceIndex) => (
                          <div key={sourceIndex} className="bg-gray-50 rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm text-gray-900">
                                {source.filename}
                              </div>
                              {source.similarity && (
                                <div className="text-xs text-gray-500">
                                  {Math.round(source.similarity * 100)}% match
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 mb-2">
                              <span className="font-medium">Client:</span> {source.client}
                              {source.author && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span className="font-medium">Author:</span> {source.author}
                                </>
                              )}
                              {source.sector && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span className="font-medium">Sector:</span> {source.sector}
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-700 line-clamp-2">
                              {source.content.substring(0, 200)}...
                            </div>
                            {source.tags && source.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {source.tags.slice(0, 3).map((tag, tagIndex) => (
                                  <span key={tagIndex} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                    {tag}
                                  </span>
                                ))}
                                {source.tags.length > 3 && (
                                  <span className="text-xs text-gray-500">+{source.tags.length - 3} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proactive Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        💡 Follow-up suggestions:
                      </h4>
                      <div className="space-y-2">
                        {message.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="block w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback Buttons */}
                  {message.role === 'assistant' && message.chunk_ids !== undefined && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">
                          Was this helpful?
                        </h4>
                        {message.feedback_given ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              Thanks for your feedback!
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              message.feedback_given === 'good' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {message.feedback_given === 'good' ? '👍 Good' : '👎 Bad'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleFeedback(index, 'good')}
                              className="flex items-center space-x-1 px-3 py-1 text-sm text-green-700 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                            >
                              <span>👍</span>
                              <span>Good</span>
                            </button>
                            <button
                              onClick={() => handleFeedback(index, 'bad')}
                              className="flex items-center space-x-1 px-3 py-1 text-sm text-red-700 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            >
                              <span>👎</span>
                              <span>Bad</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                  <span className="text-sm text-gray-600">Searching your proposals...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about past proposals, clients, successful approaches..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              What could be improved?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Help us understand what went wrong so we can improve the system.
            </p>
            <textarea
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              placeholder="e.g., Wrong results, missing information, poor formatting, misunderstood query..."
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setFeedbackModal(null);
                  setFeedbackReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => submitFeedback(feedbackModal.messageIndex, feedbackModal.rating, feedbackReason.trim() || undefined)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 