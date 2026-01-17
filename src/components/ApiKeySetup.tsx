import React, { useState } from 'react';
import { Key, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface ApiKeySetupProps {
  onSubmit: (apiKey: string) => void;
}

export function ApiKeySetup({ onSubmit }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }
    if (!apiKey.startsWith('sk-ant-')) {
      setError('API key should start with "sk-ant-"');
      return;
    }
    onSubmit(apiKey.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-radial">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Smart Kanban</h1>
          <p className="text-dark-400">Your intelligent task companion</p>
        </div>

        {/* Setup Card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-medium text-white">Connect Claude API</h2>
              <p className="text-sm text-dark-400">Your key stays local</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-2">
                Claude API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError('');
                  }}
                  placeholder="sk-ant-api03-..."
                  className="w-full px-4 py-3 bg-dark-850 border border-dark-700 rounded-xl 
                           text-white placeholder-dark-500 pr-12
                           focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                           transition-smooth"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 
                           hover:text-dark-300 transition-smooth"
                >
                  {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 
                       bg-accent hover:bg-accent-light rounded-xl font-medium
                       text-dark-950 transition-smooth group"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-700">
            <p className="text-xs text-dark-400 text-center">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-light transition-smooth"
              >
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            { emoji: '🥬', label: 'Groceries' },
            { emoji: '📚', label: 'Learning' },
            { emoji: '✈️', label: 'Travel' },
            { emoji: '⏰', label: 'Reminders' },
          ].map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-850/50 
                       border border-dark-800"
            >
              <span className="text-xl">{feature.emoji}</span>
              <span className="text-sm text-dark-300">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
