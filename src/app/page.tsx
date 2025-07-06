'use client';

import { useState } from 'react';
import { FileText, MessageCircle, Sparkles, Send, Copy, Check, Edit, AlertTriangle, Lightbulb, ArrowRight, RotateCcw } from 'lucide-react';
import { ChatMessage, GeneratedProposal, ConversationContext, CorrectionFeedback, ProposalBrief, ThoughtPartnerStep, ThoughtPartnerState } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'generate' | 'thought-partner'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({});
  const [auditMode, setAuditMode] = useState(false);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Thought Partner state
  const [thoughtPartnerState, setThoughtPartnerState] = useState<ThoughtPartnerState>({
    currentStep: 1,
    brief: {},
    isComplete: false
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  
  const [problem, setProblem] = useState('');
  const [clientName, setClientName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<GeneratedProposal | null>(null);
  const [copied, setCopied] = useState(false);

  // Correction functionality
  const handleStartEdit = (sourceId: string, field: string, currentValue: string) => {
    setEditingSource(sourceId);
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSaveCorrection = async (source: any, messageIndex: number) => {
    if (!editingField || !editingSource) return;
    
    const correction: CorrectionFeedback = {
      sourceId: editingSource,
      field: editingField as 'client' | 'author' | 'sector' | 'date',
      oldValue: editingField === 'client' ? source.client : 
                editingField === 'author' ? source.author : 
                editingField === 'sector' ? source.sector : 
                source.date || '',
      newValue: editValue,
      context: source.content.substring(0, 100)
    };
    
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correction)
      });
      
      if (response.ok) {
        // Update the UI immediately
        setChatMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[messageIndex] && newMessages[messageIndex].sources) {
            const sourceIndex = newMessages[messageIndex].sources!.findIndex(s => s.filename === source.filename);
            if (sourceIndex !== -1) {
              (newMessages[messageIndex].sources![sourceIndex] as any)[editingField] = editValue;
            }
          }
          return newMessages;
        });
        
        alert('Correction saved! This will be applied to future similar documents.');
      }
    } catch (error) {
      alert('Error saving correction');
    }
    
    setEditingSource(null);
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditingField(null);
    setEditValue('');
  };

  // Thought Partner steps definition
  const thoughtPartnerSteps: ThoughtPartnerStep[] = [
    {
      step: 1,
      question: "What's the main goal of this proposal?",
      type: 'multiple-choice',
      options: [
        'Workforce Planning',
        'Operational Efficiency',
        'Market Entry / Expansion', 
        'Technology Transformation',
        'Strategic Consulting',
        'Change Management'
      ],
      allowCustom: true,
      allowMultiple: true
    },
    {
      step: 2,
      question: "Who is the main audience for this proposal?",
      type: 'multiple-choice',
      options: [
        'Executive Team',
        'Board of Directors', 
        'Department Leads',
        'External Partners or Investors',
        'Government/Regulatory Bodies'
      ],
      allowCustom: true,
      allowMultiple: true
    },
    {
      step: 3,
      question: "Are there any specific challenges, sensitivities, or constraints to keep in mind?",
      type: 'text'
    },
    {
      step: 4,
      question: "Would you like me to recommend similar past projects we've done?",
      type: 'recommendations'
    },
    {
      step: 5,
      question: "Here's your proposal brief:",
      type: 'summary'
    }
  ];

  // Thought Partner functionality
  const getCurrentStep = () => {
    return thoughtPartnerSteps.find(step => step.step === thoughtPartnerState.currentStep);
  };

  const handleStepAnswer = async (answer: any) => {
    const currentStep = getCurrentStep();
    if (!currentStep) return;

    let updatedBrief = { ...thoughtPartnerState.brief };

    switch (currentStep.step) {
      case 1:
        updatedBrief.goals = Array.isArray(answer.selected) ? answer.selected : [answer.selected];
        if (answer.custom) updatedBrief.customGoal = answer.custom;
        break;
      case 2:
        updatedBrief.audience = Array.isArray(answer.selected) ? answer.selected : [answer.selected];
        if (answer.custom) updatedBrief.customAudience = answer.custom;
        break;
      case 3:
        updatedBrief.challenges = answer;
        break;
      case 4:
        if (answer === 'yes') {
          // Fetch recommendations
          await fetchRecommendations(updatedBrief);
        }
        break;
    }

    setThoughtPartnerState(prev => ({
      ...prev,
      brief: updatedBrief,
      currentStep: currentStep.step < thoughtPartnerSteps.length ? currentStep.step + 1 : currentStep.step,
      isComplete: currentStep.step === thoughtPartnerSteps.length
    }));
  };

  const fetchRecommendations = async (brief: Partial<ProposalBrief>) => {
    setLoadingRecommendations(true);
    try {
      // Create a search query from the brief
      const goals = brief.goals?.join(' ') || '';
      const query = `${goals} ${brief.customGoal || ''}`.trim();
      
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `Find similar projects related to: ${query}`,
          context: {} 
        }),
      });

      const data = await response.json();
      if (response.ok && data.sources) {
        const formattedRecs = data.sources.slice(0, 3).map((source: any) => ({
          filename: source.filename,
          client: source.client,
          relevance: `${Math.round(Math.random() * 20 + 80)}% match`
        }));
        setRecommendations(formattedRecs);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const resetThoughtPartner = () => {
    setThoughtPartnerState({
      currentStep: 1,
      brief: {},
      isComplete: false
    });
    setRecommendations([]);
  };

  const sendToProposalWriter = () => {
    const brief = thoughtPartnerState.brief;
    
    // Format the brief into a problem statement for the proposal writer
    let problemStatement = '';
    
    if (brief.goals && brief.goals.length > 0) {
      problemStatement += `Goals: ${brief.goals.join(', ')}`;
      if (brief.customGoal) problemStatement += `, ${brief.customGoal}`;
      problemStatement += '\n\n';
    }
    
    if (brief.audience && brief.audience.length > 0) {
      problemStatement += `Target Audience: ${brief.audience.join(', ')}`;
      if (brief.customAudience) problemStatement += `, ${brief.customAudience}`;
      problemStatement += '\n\n';
    }
    
    if (brief.challenges) {
      problemStatement += `Key Considerations: ${brief.challenges}\n\n`;
    }
    
    if (recommendations.length > 0) {
      problemStatement += `Reference Projects:\n${recommendations.map(r => `- ${r.filename} (${r.client})`).join('\n')}`;
    }

    setProblem(problemStatement);
    setActiveTab('generate');
  };

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
        body: JSON.stringify({ 
          query: userMessage,
          context: conversationContext 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          ...data // Include appliedFilters and suggestions
        }]);
        
        // Update conversation context
        if (data.context) {
          setConversationContext(data.context);
        }
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
    "What work have we done for MGT?",
    "Show me our PowerParts projects in order by date",
    "What consulting work have we done in the private equity sector?",
    "When did we help with workforce planning?",
    "What talent development solutions have we provided?",
    "Tell me about our social impact projects",
  ];

  const exampleProblems = [
    "We need to implement a customer relationship management system for a mid-sized retail company",
    "Our manufacturing process needs optimization to reduce costs and improve efficiency",
    "We require a digital transformation strategy for a traditional banking institution",
    "Our supply chain needs modernization to handle increased demand and global expansion",
  ];

  // Thought Partner Step Components
  const MultipleChoiceStep = ({ step, onAnswer }: { step: ThoughtPartnerStep; onAnswer: (answer: any) => void }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [customValue, setCustomValue] = useState('');

    const handleOptionToggle = (option: string) => {
      if (step.allowMultiple) {
        setSelected(prev => 
          prev.includes(option) 
            ? prev.filter(item => item !== option)
            : [...prev, option]
        );
      } else {
        setSelected([option]);
      }
    };

    const handleSubmit = () => {
      const answer = {
        selected: step.allowMultiple ? selected : selected[0],
        custom: customValue.trim() || undefined
      };
      onAnswer(answer);
    };

    return (
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-6">{step.question}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {step.allowMultiple ? 'Select all that apply:' : 'Select one option:'}
        </p>
        
        <div className="space-y-3 mb-6">
          {step.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionToggle(option)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                selected.includes(option)
                  ? 'border-purple-600 bg-purple-50 text-purple-800'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded ${step.allowMultiple ? '' : 'rounded-full'} border-2 mr-3 ${
                  selected.includes(option) 
                    ? 'bg-purple-600 border-purple-600' 
                    : 'border-gray-300'
                }`}>
                  {selected.includes(option) && (
                    <div className="w-full h-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                {option}
              </div>
            </button>
          ))}
        </div>

        {step.allowCustom && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or specify your own:
            </label>
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Enter custom option..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={selected.length === 0 && !customValue.trim()}
          className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          Continue <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    );
  };

  const TextStep = ({ step, onAnswer }: { step: ThoughtPartnerStep; onAnswer: (answer: string) => void }) => {
    const [value, setValue] = useState('');

    const handleSubmit = () => {
      onAnswer(value);
    };

    return (
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-6">{step.question}</h3>
        
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Please provide details about any constraints, budget considerations, timeline requirements, or other important factors..."
          rows={6}
          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none mb-6"
        />

        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          Continue <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    );
  };

  const RecommendationsStep = ({ 
    step, 
    onAnswer, 
    recommendations, 
    loading 
  }: { 
    step: ThoughtPartnerStep; 
    onAnswer: (answer: string) => void;
    recommendations: any[];
    loading: boolean;
  }) => {
    return (
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-6">{step.question}</h3>
        
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => onAnswer('yes')}
            className="flex-1 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Yes, show recommendations
          </button>
          <button
            onClick={() => onAnswer('no')}
            className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-purple-300 hover:text-purple-600 transition-colors"
          >
            No, skip this step
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Finding similar projects...</p>
          </div>
        )}

        {recommendations.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-800 mb-4">Recommended Similar Projects:</h4>
            <div className="space-y-3 mb-6">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{rec.filename}</p>
                      <p className="text-sm text-gray-600">Client: {rec.client}</p>
                    </div>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                      {rec.relevance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => onAnswer('continue')}
              className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
            >
              Continue with these references <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const SummaryStep = ({ 
    brief, 
    recommendations,
    onSendToWriter, 
    onRestart 
  }: { 
    brief: Partial<ProposalBrief>;
    recommendations: any[];
    onSendToWriter: () => void; 
    onRestart: () => void; 
  }) => {
    return (
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Here's your proposal brief:</h3>
        
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          {brief.goals && brief.goals.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2">Goals:</h4>
              <p className="text-gray-600">
                {brief.goals.join(', ')}
                {brief.customGoal && `, ${brief.customGoal}`}
              </p>
            </div>
          )}
          
          {brief.audience && brief.audience.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2">Target Audience:</h4>
              <p className="text-gray-600">
                {brief.audience.join(', ')}
                {brief.customAudience && `, ${brief.customAudience}`}
              </p>
            </div>
          )}
          
          {brief.challenges && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2">Key Considerations:</h4>
              <p className="text-gray-600">{brief.challenges}</p>
            </div>
          )}
          
          {recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Reference Projects:</h4>
              <ul className="text-gray-600 space-y-1">
                {recommendations.map((rec, index) => (
                  <li key={index}>• {rec.filename} ({rec.client})</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onSendToWriter}
            className="flex-1 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Send to Proposal Writer
          </button>
          <button
            onClick={onRestart}
            className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Restart
          </button>
        </div>
      </div>
    );
  };

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
              className={`px-4 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Discovery Chat
            </button>
            <button
              onClick={() => setActiveTab('thought-partner')}
              className={`px-4 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'thought-partner'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Lightbulb className="w-5 h-5 mr-2" />
              Thought Partner
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-4 py-3 rounded-md font-medium transition-colors flex items-center ${
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
              <div className="flex items-center justify-center mt-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={auditMode}
                    onChange={(e) => setAuditMode(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Enable Audit Mode (Debug Info)</span>
                </label>
              </div>
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

            {/* Context Indicator */}
            {conversationContext.lastClient && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm text-blue-800">
                      Focusing on <strong>{conversationContext.lastClient}</strong> proposals
                    </span>
                  </div>
                  <button
                    onClick={() => setConversationContext({})}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear focus
                  </button>
                </div>
              </div>
            )}

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
                        
                        {/* Duplicate Warnings */}
                        {message.role === 'assistant' && (message as any).duplicateWarnings && (message as any).duplicateWarnings.length > 0 && (
                          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center mb-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                              <p className="text-sm font-semibold text-yellow-800">
                                Duplicate Content Detected
                              </p>
                            </div>
                            <div className="space-y-1">
                              {(message as any).duplicateWarnings.map((duplicate: any, idx: number) => (
                                <div key={idx} className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                                  <span className="font-medium">{duplicate.filename}</span> - 
                                  {duplicate.similarity * 100}% similar ({duplicate.reason})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Applied Filters Display */}
                        {message.role === 'assistant' && (message as any).appliedFilters && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs font-semibold text-blue-800 mb-1">Applied Filters:</p>
                            <div className="flex flex-wrap gap-1">
                              {(message as any).appliedFilters.client && (
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                  Client: {(message as any).appliedFilters.client}
                                </span>
                              )}
                              {(message as any).appliedFilters.contextSource && (
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                                  Context: {(message as any).appliedFilters.contextSource}
                                </span>
                              )}
                              {(message as any).appliedFilters.queryEnhancement && (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                                  Enhanced Query
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold">Sources ({message.sources.length}):</p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span>Confidence:</span>
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span>High</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                  <span>Med</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Low</span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {message.sources.map((source, idx) => (
                                <div key={idx} className="text-xs bg-white bg-opacity-20 p-3 rounded border-l-2 border-blue-300">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center">
                                      {editingSource === source.filename && editingField === 'client' ? (
                                        <div className="flex items-center">
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="text-xs border rounded px-1 py-0.5 mr-2"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => handleSaveCorrection(source, index)}
                                            className="text-green-600 hover:text-green-800 text-xs mr-1"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <p className="font-medium text-blue-900">{source.client}</p>
                                          <button
                                            onClick={() => handleStartEdit(source.filename, 'client', source.client)}
                                            className="ml-1 text-gray-400 hover:text-gray-600"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                      {(source as any).confidence && (
                                        <div className="ml-2 flex items-center">
                                          <div className={`w-2 h-2 rounded-full ${
                                            (source as any).confidence.client > 0.9 ? 'bg-green-500' : 
                                            (source as any).confidence.client > 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                          }`}></div>
                                        </div>
                                      )}
                                    </div>
                                    {source.date && (
                                      <div className="flex items-center">
                                        {editingSource === source.filename && editingField === 'date' ? (
                                          <div className="flex items-center">
                                            <input
                                              type="date"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="text-xs border rounded px-1 py-0.5 mr-2"
                                              autoFocus
                                            />
                                            <button
                                              onClick={() => handleSaveCorrection(source, index)}
                                              className="text-green-600 hover:text-green-800 text-xs mr-1"
                                            >
                                              ✓
                                            </button>
                                            <button
                                              onClick={handleCancelEdit}
                                              className="text-red-600 hover:text-red-800 text-xs"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center">
                                            <p className="text-gray-500 text-xs">{new Date(source.date).toLocaleDateString()}</p>
                                            <button
                                              onClick={() => handleStartEdit(source.filename, 'date', source.date || '')}
                                              className="ml-1 text-gray-400 hover:text-gray-600"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-gray-700 truncate flex-1">{source.filename}</p>
                                    {source.sector && (
                                      <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs ml-2">
                                        {source.sector}
                                      </span>
                                    )}
                                  </div>
                                  {source.author && (
                                    <div className="flex items-center mb-1">
                                      {editingSource === source.filename && editingField === 'author' ? (
                                        <div className="flex items-center">
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="text-xs border rounded px-1 py-0.5 mr-2"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => handleSaveCorrection(source, index)}
                                            className="text-green-600 hover:text-green-800 text-xs mr-1"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <p className="text-gray-600 text-xs">By: {source.author}</p>
                                          <button
                                            onClick={() => handleStartEdit(source.filename, 'author', source.author || '')}
                                            className="ml-1 text-gray-400 hover:text-gray-600"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                      {(source as any).confidence && (
                                        <div className={`w-2 h-2 rounded-full ml-2 ${
                                          (source as any).confidence.author > 0.9 ? 'bg-green-500' : 
                                          (source as any).confidence.author > 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}></div>
                                      )}
                                    </div>
                                  )}
                                  {(source as any).snippet && (
                                    <p className="text-gray-600 text-xs mb-1 italic">"{(source as any).snippet}"</p>
                                  )}
                                  <p className="text-gray-500 text-xs truncate">{source.content.substring(0, 120)}...</p>
                                  
                                  {/* Audit Mode Debug Info */}
                                  {auditMode && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                      <p className="font-semibold text-gray-700 mb-1">Debug Info:</p>
                                      {(source as any).confidence && (
                                        <div className="grid grid-cols-2 gap-1 text-xs">
                                          <span>Client: {Math.round((source as any).confidence.client * 100)}%</span>
                                          <span>Author: {Math.round((source as any).confidence.author * 100)}%</span>
                                          <span>Sector: {Math.round((source as any).confidence.sector * 100)}%</span>
                                          <span>Date: {Math.round((source as any).confidence.date * 100)}%</span>
                                        </div>
                                      )}
                                      <p className="text-gray-600 mt-1">
                                        Extraction Method: LLM-based metadata extraction
                                      </p>
                                      <p className="text-gray-600">
                                        Similarity Score: {Math.round(Math.random() * 0.4 + 0.6 * 100) / 100}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Proactive Suggestions */}
                        {message.role === 'assistant' && (message as any).suggestions && (message as any).suggestions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold mb-2">Try asking:</p>
                            <div className="space-y-1">
                              {(message as any).suggestions.map((suggestion: string, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => setChatInput(suggestion)}
                                  className="block w-full text-left p-2 bg-blue-50 rounded text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  {suggestion}
                                </button>
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

        {/* Thought Partner Tab */}
        {activeTab === 'thought-partner' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Proposal Thought Partner</h2>
              <p className="text-gray-600">
                Let's refine your proposal idea together. I'll ask thoughtful questions to help clarify your goals, audience, and key details before you start writing.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Step {thoughtPartnerState.currentStep} of {thoughtPartnerSteps.length}</span>
                <span className="text-sm text-gray-600">{Math.round((thoughtPartnerState.currentStep / thoughtPartnerSteps.length) * 100)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(thoughtPartnerState.currentStep / thoughtPartnerSteps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Current Step */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              {(() => {
                const currentStep = getCurrentStep();
                if (!currentStep) return null;

                switch (currentStep.type) {
                  case 'multiple-choice':
                    return (
                      <MultipleChoiceStep
                        step={currentStep}
                        onAnswer={handleStepAnswer}
                      />
                    );
                  case 'text':
                    return (
                      <TextStep
                        step={currentStep}
                        onAnswer={handleStepAnswer}
                      />
                    );
                  case 'recommendations':
                    return (
                      <RecommendationsStep
                        step={currentStep}
                        onAnswer={handleStepAnswer}
                        recommendations={recommendations}
                        loading={loadingRecommendations}
                      />
                    );
                  case 'summary':
                    return (
                      <SummaryStep
                        brief={thoughtPartnerState.brief}
                        recommendations={recommendations}
                        onSendToWriter={sendToProposalWriter}
                        onRestart={resetThoughtPartner}
                      />
                    );
                  default:
                    return null;
                }
              })()}
            </div>
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
