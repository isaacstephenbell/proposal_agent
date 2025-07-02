'use client';

import { useState } from 'react';
import { FileText, MessageCircle, Sparkles, Send, Copy, Check } from 'lucide-react';
import { ChatMessage, GeneratedProposal } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'generate'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [problem, setProblem] = useState('');
  const [clientName, setClientName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<GeneratedProposal | null>(null);
  const [copied, setCopied] = useState(false);

  // Chat functionality
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage }),
      });

      const data = await response.json();

      if (response.ok) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          sources: data.sources
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Proposal generation functionality
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim() || isGenerating) return;

    setIsGenerating(true);
    setGeneratedProposal(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: problem.trim(), client: clientName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedProposal(data);
      } else {
        alert('Error generating proposal. Please try again.');
      }
    } catch (error) {
      alert('Error generating proposal. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedProposal) {
      await navigator.clipboard.writeText(generatedProposal.proposal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const exampleQuestions = [
    "Have we solved a problem like this before?",
    "What client did we help with similar issues?",
    "What approach did we use for this type of project?",
    "What was our timeline for similar projects?",
  ];

  const exampleProblems = [
    "We need to implement a customer relationship management system for a mid-sized retail company",
    "Our manufacturing process needs optimization to reduce costs and improve efficiency",
    "We require a digital transformation strategy for a traditional banking institution",
    "Our supply chain needs modernization to handle increased demand and global expansion",
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <FileText className="w-12 h-12 text-blue-600 mr-4" />
            <h1 className="text-5xl font-bold text-gray-900">Proposal Writing Assistant</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Leverage the power of AI to create compelling proposals based on our historical success patterns. 
            Generate structured proposals or discover insights from past projects.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Discovery Chat
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'generate'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Proposal
            </button>
          </div>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ask About Our Historical Proposals</h2>
              <p className="text-gray-600">
                Discover insights, approaches, and solutions from our past successful projects.
              </p>
            </div>

            {/* Example Questions */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Try asking:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setChatInput(question)}
                    className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-gray-700"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6 min-h-[400px] max-h-[600px] overflow-y-auto">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Start a conversation to discover insights from our proposal history</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold mb-2">Sources:</p>
                            <div className="space-y-1">
                              {message.sources.map((source, idx) => (
                                <div key={idx} className="text-xs bg-white bg-opacity-20 p-2 rounded">
                                  <p className="font-medium">{source.client}</p>
                                  <p className="text-gray-600">{source.filename}</p>
                                  <p className="text-gray-500 truncate">{source.content.substring(0, 100)}...</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-800 p-4 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleChatSubmit} className="flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about our historical proposals..."
                className="flex-1 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isChatLoading}
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate New Proposal</h2>
              <p className="text-gray-600">
                Create structured proposals based on our historical success patterns.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Input Section */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Problem Statement</h3>
                
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Enter client name..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Problem Statement *
                    </label>
                    <textarea
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      placeholder="Describe the problem or challenge that needs to be solved..."
                      rows={6}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating || !problem.trim()}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Proposal
                      </>
                    )}
                  </button>
                </form>

                {/* Example Problems */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Example Problems:</h4>
                  <div className="space-y-2">
                    {exampleProblems.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setProblem(example)}
                        className="text-left p-2 bg-gray-50 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors w-full"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Output Section */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Generated Proposal</h3>
                  {generatedProposal && (
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  )}
                </div>

                {!generatedProposal && !isGenerating ? (
                  <div className="text-center text-gray-500 py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Your generated proposal will appear here</p>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Analyzing historical proposals...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Generated Proposal */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Proposal Content:</h4>
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                          {generatedProposal?.proposal}
                        </pre>
                      </div>
                    </div>

                    {/* Sources */}
                    {generatedProposal?.sources && generatedProposal.sources.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">Based on Historical Proposals:</h4>
                        <div className="space-y-2">
                          {generatedProposal.sources.map((source, index) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="font-medium text-blue-900">{source.client}</p>
                              <p className="text-sm text-blue-700">{source.filename}</p>
                              <p className="text-xs text-blue-600 mt-1 truncate">{source.content.substring(0, 150)}...</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
