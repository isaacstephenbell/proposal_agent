'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RecentProposal {
  id: string;
  title: string;
  status: 'draft' | 'in-progress' | 'final';
  lastEdited: string;
  client?: string;
}

interface UserStats {
  proposalsCreated: number;
  blocksSaved: number;
  activeProjects: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [recentProposals, setRecentProposals] = useState<RecentProposal[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    proposalsCreated: 0,
    blocksSaved: 0,
    activeProjects: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // For now, we'll use mock data - these can be connected to real APIs later
      const mockProposals: RecentProposal[] = [
        {
          id: '1',
          title: 'MGT Workforce Planning Strategy',
          status: 'draft',
          lastEdited: '2 hours ago',
          client: 'MGT'
        },
        {
          id: '2',
          title: 'PowerParts Market Analysis',
          status: 'final',
          lastEdited: 'Yesterday',
          client: 'PowerParts Group'
        },
        {
          id: '3',
          title: 'Crux Capital Due Diligence',
          status: 'in-progress',
          lastEdited: '3 days ago',
          client: 'Crux Capital'
        }
      ];

      const mockStats: UserStats = {
        proposalsCreated: 15,
        blocksSaved: 42,
        activeProjects: 8
      };

      setRecentProposals(mockProposals);
      setUserStats(mockStats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'final': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return '📝';
      case 'in-progress': return '🔄';
      case 'final': return '✅';
      default: return '📄';
    }
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
              <h1 className="text-2xl font-bold text-gray-900">🏠 Proposal AI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back! Ready to create your next winning proposal?
          </h2>
          <p className="text-gray-600">
            Choose your starting point below, or continue working on a recent proposal.
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Discovery Chat */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group">
            <Link href="/chat">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Discovery Chat</h3>
                <p className="text-sm font-medium text-green-600 mb-3">Explore Past Proposals</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Search and learn from your proposal history. Ask questions about past work to inform your new proposals.
                </p>
              </div>
            </Link>
          </div>

          {/* Thought Partner */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group">
            <Link href="/thought-partner">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-200 transition-colors">
                  <span className="text-2xl">✨</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Proposal Thought Partner</h3>
                <p className="text-sm font-medium text-orange-600 mb-3">Clarify Proposal Scope & Goals</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Get guided through proposal planning step-by-step. Define goals, audience, and constraints before writing.
                </p>
              </div>
            </Link>
          </div>

          {/* Proposal Writer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group">
            <Link href="/writer">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors">
                  <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Proposal Writer</h3>
                <p className="text-sm font-medium text-purple-600 mb-3">Start Writing a Proposal</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Jump straight into drafting with AI assistance and smart suggestions from your block library.
                </p>
              </div>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Proposals */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Recent Proposals</h3>
              <div className="space-y-4">
                {recentProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/writer?id=${proposal.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{getStatusIcon(proposal.status)}</div>
                      <div>
                        <h4 className="font-medium text-gray-900">{proposal.title}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1).replace('-', ' ')}
                          </span>
                          {proposal.client && (
                            <span className="text-sm text-gray-500">• {proposal.client}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Last edited {proposal.lastEdited}</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      {proposal.status === 'final' ? 'View' : 'Open'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Your Impact Stats */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Your Impact</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">📋</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Proposals Created</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.proposalsCreated}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">📚</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Blocks Saved</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.blocksSaved}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">🎯</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active Projects</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.activeProjects}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100">
                <Link 
                  href="/blocks"
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  Manage your block library →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 