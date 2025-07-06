'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BlockSaver from '@/components/BlockSaver';
import BlockBrowser from '@/components/BlockBrowser';
import SuggestedBlocks from '@/components/SuggestedBlocks';
import ExternalResearchPanel from '@/components/ExternalResearchPanel';

interface ProposalBrief {
  goals: string[];
  audience: string[];
  constraints: string;
  useReferences: boolean;
}

interface ProposalDocument {
  id?: string;
  title: string;
  content: string;
  client?: string;
  status: 'draft' | 'in-progress' | 'final';
  lastSaved: Date;
  brief?: ProposalBrief;
}

export default function ProposalWriter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [document, setDocument] = useState<ProposalDocument>({
    title: 'Untitled Proposal',
    content: '',
    status: 'draft',
    lastSaved: new Date()
  });
  
  const [brief, setBrief] = useState<ProposalBrief | null>(null);
  const [isShowingBlockBrowser, setIsShowingBlockBrowser] = useState(false);
  const [isShowingBlockSaver, setIsShowingBlockSaver] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{start: number, end: number} | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShowingExternalResearch, setIsShowingExternalResearch] = useState(false);

  useEffect(() => {
    // Check if coming from thought partner
    const fromThoughtPartner = searchParams.get('from') === 'thought-partner';
    if (fromThoughtPartner) {
      const storedBrief = sessionStorage.getItem('proposalBrief');
      if (storedBrief) {
        const parsedBrief = JSON.parse(storedBrief) as ProposalBrief;
        setBrief(parsedBrief);
        setDocument(prev => ({ ...prev, brief: parsedBrief }));
      }
    }

    // Load existing proposal if ID provided
    const proposalId = searchParams.get('id');
    if (proposalId) {
      loadProposal(proposalId);
    }
  }, [searchParams]);

  const loadProposal = async (id: string) => {
    // Mock loading existing proposal - replace with actual API call
    const mockProposal: ProposalDocument = {
      id,
      title: 'MGT Workforce Planning Strategy',
      content: `# MGT Workforce Planning Strategy

## Executive Summary

This proposal outlines a comprehensive workforce planning strategy for MGT to address upcoming organizational challenges and opportunities.

## Current Situation

[Your analysis here...]

## Proposed Solution

[Your recommendations here...]`,
      client: 'MGT',
      status: 'draft',
      lastSaved: new Date()
    };

    setDocument(mockProposal);
  };

  const handleTextSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end);

    if (text.length > 0) {
      setSelectedText(text);
      setSelectedRange({ start, end });
    } else {
      setSelectedText('');
      setSelectedRange(null);
    }
  };

  const handleSaveAsBlock = () => {
    if (selectedText.length > 10) {
      setIsShowingBlockSaver(true);
    }
  };

  const handleInsertBlock = (content: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = document.content;
    
    const newContent = currentContent.substring(0, start) + content + currentContent.substring(end);
    
    setDocument(prev => ({
      ...prev,
      content: newContent,
      lastSaved: new Date()
    }));

    // Focus back on textarea and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + content.length, start + content.length);
    }, 0);
  };

  const handleCopyFromExternalResearch = (content: string, source: string, query: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = document.content;
    
    // Format the external research content with clear attribution
    const timestamp = new Date().toLocaleDateString();
    const formattedContent = `

---
**[External Research Source]**: ${source}
**Query**: ${query}
**Date**: ${timestamp}
**Content**:
${content}
---

`;
    
    const newContent = currentContent.substring(0, start) + formattedContent + currentContent.substring(end);
    
    setDocument(prev => ({
      ...prev,
      content: newContent,
      lastSaved: new Date()
    }));

    // Focus back on textarea and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedContent.length, start + formattedContent.length);
    }, 0);
  };

  const handleGenerateContent = async () => {
    if (!aiPrompt.trim()) return;

    setIsGeneratingContent(true);
    
    try {
      const context = {
        brief: brief,
        currentContent: document.content,
        prompt: aiPrompt
      };

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      handleInsertBlock(data.content);
      setAiPrompt('');
      setShowAIAssistant(false);
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleSaveProposal = async () => {
    setIsLoading(true);
    try {
      // Mock save - replace with actual API call
      console.log('Saving proposal:', document);
      setDocument(prev => ({ ...prev, lastSaved: new Date() }));
    } catch (error) {
      console.error('Error saving proposal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getContextForBlocks = () => {
    return {
      client: document.client || 'Unknown',
      goals: brief?.goals || [],
      audience: brief?.audience || [],
      content: document.content
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar - Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
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
          <h1 className="text-lg font-semibold text-gray-900">📝 Proposal Writer</h1>
        </div>

        <div className="p-4 flex-1">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proposal Title
            </label>
            <input
              type="text"
              value={document.title}
              onChange={(e) => setDocument(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client
            </label>
            <input
              type="text"
              value={document.client || ''}
              onChange={(e) => setDocument(prev => ({ ...prev, client: e.target.value }))}
              placeholder="Client name..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={document.status}
              onChange={(e) => setDocument(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="in-progress">In Progress</option>
              <option value="final">Final</option>
            </select>
          </div>

          {brief && (
            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <h3 className="text-sm font-medium text-blue-900 mb-2">✨ Brief Context</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium">Goals:</span> {brief.goals.slice(0, 2).join(', ')}
                  {brief.goals.length > 2 && '...'}
                </div>
                <div>
                  <span className="font-medium">Audience:</span> {brief.audience.slice(0, 2).join(', ')}
                  {brief.audience.length > 2 && '...'}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => setIsShowingBlockBrowser(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
            >
              📚 Browse Blocks
            </button>
            
            <button
              onClick={handleSaveAsBlock}
              disabled={!selectedText}
              className={`w-full py-2 px-4 rounded-md text-sm ${
                selectedText 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              💾 Save as Block
            </button>

            <button
              onClick={() => setShowAIAssistant(true)}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 text-sm"
            >
              🤖 AI Assistant
            </button>

            <button
              onClick={() => setIsShowingExternalResearch(true)}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 text-sm"
            >
              🔍 Search External Sources (Web & AI)
            </button>

            <button
              onClick={handleSaveProposal}
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded-md text-sm ${
                isLoading 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {isLoading ? 'Saving...' : '💾 Save Proposal'}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          Last saved: {document.lastSaved.toLocaleTimeString()}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">{document.title}</h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              document.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              document.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {document.status.charAt(0).toUpperCase() + document.status.slice(1).replace('-', ' ')}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {document.content.length} characters
            </span>
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex">
          <div className="flex-1 p-6">
            <textarea
              ref={textareaRef}
              value={document.content}
              onChange={(e) => setDocument(prev => ({ ...prev, content: e.target.value }))}
              onSelect={handleTextSelection}
              placeholder="Start writing your proposal here...

You can:
• Select text and save it as a reusable block
• Browse your block library for inspiration
• Use the AI assistant for content generation
• Check the sidebar for suggested blocks"
              className="w-full h-full border border-gray-300 rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
            />
          </div>

          {/* Right Sidebar - Suggested Blocks */}
          {rightSidebarOpen && (
            <div className="w-80 bg-white border-l border-gray-200">
              <SuggestedBlocks
                context={getContextForBlocks()}
                onInsertBlock={handleInsertBlock}
              />
            </div>
          )}
        </div>
      </div>

      {/* Block Browser Modal */}
      {isShowingBlockBrowser && (
        <BlockBrowser
          isOpen={isShowingBlockBrowser}
          onClose={() => setIsShowingBlockBrowser(false)}
          onInsertBlock={handleInsertBlock}
        />
      )}

      {/* Block Saver Modal */}
      {isShowingBlockSaver && (
        <BlockSaver
          isOpen={isShowingBlockSaver}
          onClose={() => setIsShowingBlockSaver(false)}
          selectedText={selectedText}
          onSaved={() => {
            setIsShowingBlockSaver(false);
            setSelectedText('');
            setSelectedRange(null);
          }}
        />
      )}

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 AI Assistant</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What would you like me to write?
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., 'Write an executive summary for a workforce planning proposal' or 'Expand on the current situation section'"
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAIAssistant(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateContent}
                disabled={isGeneratingContent || !aiPrompt.trim()}
                className={`px-4 py-2 rounded-md ${
                  isGeneratingContent || !aiPrompt.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isGeneratingContent ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Research Panel */}
      <ExternalResearchPanel
        isOpen={isShowingExternalResearch}
        onClose={() => setIsShowingExternalResearch(false)}
        onCopyToProposal={handleCopyFromExternalResearch}
      />
    </div>
  );
} 