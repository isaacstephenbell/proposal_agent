'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProposalBrief {
  goals: string[];
  customGoal?: string;
  audience: string[];
  customAudience?: string;
  constraints: string;
  useReferences: boolean;
  referenceProposals?: string[];
}

const STEP_QUESTIONS = [
  {
    id: 1,
    title: "What's the primary goal of this proposal?",
    subtitle: "Select all that apply or write your own",
    type: "multiple-choice" as const,
    options: [
      "Workforce Planning & Assessment",
      "ERP Migration Strategy", 
      "Market Research & Analysis",
      "Due Diligence Support",
      "Technology Assessment",
      "Change Management",
      "Process Improvement",
      "Strategic Planning"
    ],
    allowCustom: true,
    field: "goals" as keyof ProposalBrief
  },
  {
    id: 2,
    title: "Who is your primary audience?",
    subtitle: "Who will be reading and making decisions based on this proposal?",
    type: "multiple-choice" as const,
    options: [
      "C-Suite Executives",
      "IT Leadership", 
      "HR Leadership",
      "Operations Management",
      "Board of Directors",
      "Department Heads",
      "Project Stakeholders",
      "External Partners"
    ],
    allowCustom: true,
    field: "audience" as keyof ProposalBrief
  },
  {
    id: 3,
    title: "What are the key constraints or challenges?",
    subtitle: "Help us understand limitations, timeline pressures, budget constraints, etc.",
    type: "text" as const,
    placeholder: "e.g., 6-month timeline, $2M budget cap, regulatory requirements, stakeholder concerns...",
    field: "constraints" as keyof ProposalBrief
  },
  {
    id: 4,
    title: "Should we recommend relevant past proposals?",
    subtitle: "We can suggest similar work you've done before to inspire this proposal",
    type: "boolean" as const,
    field: "useReferences" as keyof ProposalBrief
  }
];

export default function ThoughtPartner() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [brief, setBrief] = useState<ProposalBrief>({
    goals: [],
    audience: [],
    constraints: '',
    useReferences: false
  });
  const [customInput, setCustomInput] = useState('');

  const currentQuestion = STEP_QUESTIONS.find(q => q.id === currentStep);
  const totalSteps = STEP_QUESTIONS.length;

  const handleMultipleChoice = (option: string) => {
    if (!currentQuestion) return;
    
    const field = currentQuestion.field;
    const currentArray = brief[field] as string[] || [];
    
    setBrief(prev => ({
      ...prev,
      [field]: currentArray.includes(option)
        ? currentArray.filter(item => item !== option)
        : [...currentArray, option]
    }));
  };

  const handleCustomAdd = () => {
    if (!currentQuestion || !customInput.trim()) return;
    
    const field = currentQuestion.field;
    const currentArray = brief[field] as string[] || [];
    
    if (!currentArray.includes(customInput.trim())) {
      setBrief(prev => ({
        ...prev,
        [field]: [...currentArray, customInput.trim()]
      }));
    }
    setCustomInput('');
  };

  const handleTextInput = (value: string) => {
    if (!currentQuestion) return;
    
    setBrief(prev => ({
      ...prev,
      [currentQuestion.field]: value
    }));
  };

  const handleBooleanChoice = (value: boolean) => {
    if (!currentQuestion) return;
    
    setBrief(prev => ({
      ...prev,
      [currentQuestion.field]: value
    }));
  };

  const canContinue = () => {
    if (!currentQuestion) return false;
    
    const value = brief[currentQuestion.field];
    
    switch (currentQuestion.type) {
      case 'multiple-choice':
        return Array.isArray(value) && value.length > 0;
      case 'text':
        return typeof value === 'string' && value.trim().length > 0;
      case 'boolean':
        return value !== undefined;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSendToWriter = () => {
    // Store the brief in sessionStorage or pass as URL params
    sessionStorage.setItem('proposalBrief', JSON.stringify(brief));
    router.push('/writer?from=thought-partner');
  };

  if (currentStep > totalSteps) {
    // Show final summary
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">✨ Your Proposal Brief</h1>
              <p className="text-gray-600">Here's what we captured about your proposal scope and goals</p>
            </div>

            <div className="space-y-6 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">🎯 Goals</h3>
                <div className="flex flex-wrap gap-2">
                  {brief.goals.map((goal, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {goal}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">👥 Audience</h3>
                <div className="flex flex-wrap gap-2">
                  {brief.audience.map((aud, index) => (
                    <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                      {aud}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Constraints</h3>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-md">{brief.constraints}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">📚 References</h3>
                <p className="text-gray-700">
                  {brief.useReferences 
                    ? "We'll suggest relevant past proposals while you write"
                    : "Starting fresh without reference to past work"
                  }
                </p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Ready to start writing?</h3>
              <p className="text-blue-700 text-sm mb-4">
                This brief will help us suggest relevant content blocks and guide your proposal structure.
              </p>
              <button
                onClick={handleSendToWriter}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                → Send to Proposal Writer
              </button>
            </div>

            <div className="flex justify-center space-x-4 text-sm">
              <button
                onClick={() => setCurrentStep(1)}
                className="text-gray-500 hover:text-gray-700"
              >
                Edit Brief
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-500 hover:text-gray-700"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">✨ Proposal Thought Partner</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 mt-2">Let's clarify your proposal scope and goals</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{currentQuestion.title}</h2>
          <p className="text-gray-600 mb-6">{currentQuestion.subtitle}</p>

          {currentQuestion.type === 'multiple-choice' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleMultipleChoice(option)}
                    className={`p-3 text-left border rounded-md transition-colors ${
                      (brief[currentQuestion.field] as string[])?.includes(option)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              
              {currentQuestion.allowCustom && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Add custom option..."
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleCustomAdd()}
                    />
                    <button
                      onClick={handleCustomAdd}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentQuestion.type === 'text' && (
            <textarea
              value={brief[currentQuestion.field] as string || ''}
              onChange={(e) => handleTextInput(e.target.value)}
              placeholder={currentQuestion.placeholder}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {currentQuestion.type === 'boolean' && (
            <div className="flex space-x-4">
              <button
                onClick={() => handleBooleanChoice(true)}
                className={`flex-1 p-4 border rounded-md transition-colors ${
                  brief[currentQuestion.field] === true
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">👍</div>
                <div className="font-medium">Yes, please</div>
                <div className="text-sm text-gray-600">Show me relevant past work</div>
              </button>
              <button
                onClick={() => handleBooleanChoice(false)}
                className={`flex-1 p-4 border rounded-md transition-colors ${
                  brief[currentQuestion.field] === false
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">🆕</div>
                <div className="font-medium">No thanks</div>
                <div className="text-sm text-gray-600">Start with a blank slate</div>
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-md font-medium ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            ← Back
          </button>
          
          <button
            onClick={currentStep === totalSteps ? () => setCurrentStep(currentStep + 1) : handleNext}
            disabled={!canContinue()}
            className={`px-6 py-2 rounded-md font-medium ${
              canContinue()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentStep === totalSteps ? 'Create Brief →' : 'Continue →'}
          </button>
        </div>

        {/* Progress Summary */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Progress so far:</h3>
          <div className="space-y-2 text-sm">
            <div className={`flex items-center ${currentStep > 1 ? 'text-green-600' : 'text-gray-400'}`}>
              {currentStep > 1 ? '✅' : '⏳'} Goal: {brief.goals.length > 0 ? brief.goals.join(', ') : 'Pending'}
            </div>
            <div className={`flex items-center ${currentStep > 2 ? 'text-green-600' : 'text-gray-400'}`}>
              {currentStep > 2 ? '✅' : '⏳'} Audience: {brief.audience.length > 0 ? brief.audience.join(', ') : 'Pending'}
            </div>
            <div className={`flex items-center ${currentStep > 3 ? 'text-green-600' : 'text-gray-400'}`}>
              {currentStep > 3 ? '✅' : '⏳'} Constraints: {brief.constraints ? 'Defined' : 'Pending'}
            </div>
            <div className={`flex items-center ${currentStep > 4 ? 'text-green-600' : 'text-gray-400'}`}>
              {currentStep > 4 ? '✅' : '⏳'} References: {brief.useReferences !== undefined ? (brief.useReferences ? 'Yes' : 'No') : 'Pending'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 