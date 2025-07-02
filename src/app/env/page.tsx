'use client';

import { useState } from 'react';
import { Copy, Check, AlertCircle, Info, Settings } from 'lucide-react';

export default function EnvPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const envVars = [
    {
      name: 'OPENAI_API_KEY',
      description: 'Your OpenAI API key for generating embeddings and text',
      required: true,
      example: 'sk-...',
      category: 'OpenAI'
    },
    {
      name: 'EMBEDDING_MODEL',
      description: 'The OpenAI embedding model to use (default: text-embedding-3-small)',
      required: false,
      example: 'text-embedding-3-small',
      category: 'OpenAI'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      description: 'Your Supabase project URL',
      required: true,
      example: 'https://your-project.supabase.co',
      category: 'Supabase'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      description: 'Your Supabase anonymous key (public)',
      required: true,
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      category: 'Supabase'
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      description: 'Your Supabase service role key (private, server-side only)',
      required: true,
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      category: 'Supabase'
    }
  ];

  const copyToClipboard = async (text: string, name: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateEnvFile = () => {
    const envContent = envVars.map(variable => {
      if (variable.required) {
        return `${variable.name}=your_${variable.name.toLowerCase()}_here`;
      } else {
        return `# ${variable.name}=${variable.example}`;
      }
    }).join('\n');

    return `# Environment Variables for Proposal Writing Assistant

# OpenAI Configuration
${envVars.filter(v => v.category === 'OpenAI').map(v => `${v.name}=your_${v.name.toLowerCase()}_here`).join('\n')}

# Supabase Configuration
${envVars.filter(v => v.category === 'Supabase').map(v => `${v.name}=your_${v.name.toLowerCase()}_here`).join('\n')}

# Optional Configuration
# EMBEDDING_MODEL=text-embedding-3-small`;
  };

  const copyEnvFile = async () => {
    await copyToClipboard(generateEnvFile(), 'envfile');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Settings className="w-12 h-12 text-blue-600 mr-4" />
            <h1 className="text-5xl font-bold text-gray-900">Environment Variables</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Configure your environment variables to get the Proposal Writing Assistant up and running.
          </p>
        </div>

        {/* Quick Setup */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Setup</h2>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <p className="text-gray-600 mb-4">
                Create a <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file in your project root with the following variables:
              </p>
            </div>
            <button
              onClick={copyEnvFile}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied === 'envfile' ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  Copy Template
                </>
              )}
            </button>
          </div>
        </div>

        {/* Environment Variables List */}
        <div className="space-y-8">
          {/* OpenAI Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Info className="w-6 h-6 mr-2 text-blue-600" />
              OpenAI Configuration
            </h2>
            <div className="grid gap-4">
              {envVars.filter(v => v.category === 'OpenAI').map((variable) => (
                <div key={variable.name} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <code className="bg-gray-100 px-3 py-1 rounded font-mono text-sm">
                          {variable.name}
                        </code>
                        {variable.required && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{variable.description}</p>
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-sm text-gray-500 mb-1">Example:</p>
                        <code className="text-sm font-mono">{variable.example}</code>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(variable.name, variable.name)}
                      className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {copied === variable.name ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supabase Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Info className="w-6 h-6 mr-2 text-green-600" />
              Supabase Configuration
            </h2>
            <div className="grid gap-4">
              {envVars.filter(v => v.category === 'Supabase').map((variable) => (
                <div key={variable.name} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <code className="bg-gray-100 px-3 py-1 rounded font-mono text-sm">
                          {variable.name}
                        </code>
                        {variable.required && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{variable.description}</p>
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-sm text-gray-500 mb-1">Example:</p>
                        <code className="text-sm font-mono">{variable.example}</code>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(variable.name, variable.name)}
                      className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {copied === variable.name ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-16 bg-blue-50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Setup Instructions</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-4 mt-1">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Get OpenAI API Key</h3>
                <p className="text-gray-600">
                  Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a> to create an API key.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-4 mt-1">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Create Supabase Project</h3>
                <p className="text-gray-600">
                  Visit <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase</a> to create a new project and get your API keys.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-4 mt-1">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Set Up Database</h3>
                <p className="text-gray-600">
                  Follow the database setup instructions in the README.md file to enable pgvector and create the required tables.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-4 mt-1">
                4
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Create .env.local</h3>
                <p className="text-gray-600">
                  Create a <code className="bg-gray-200 px-2 py-1 rounded">.env.local</code> file in your project root and add all the required environment variables.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Security Notice</h3>
              <ul className="text-gray-600 space-y-1 text-sm">
                <li>• Never commit your <code className="bg-yellow-100 px-1 rounded">.env.local</code> file to version control</li>
                <li>• Keep your API keys secure and rotate them regularly</li>
                <li>• Use different keys for development and production environments</li>
                <li>• The <code className="bg-yellow-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> should only be used server-side</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 