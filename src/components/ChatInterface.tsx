import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Message, CategoryType } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  currentCategory: CategoryType | null;
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  isLoading,
  currentCategory 
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getPlaceholder = () => {
    if (!currentCategory) return 'Select a category to get started...';
    switch (currentCategory) {
      case 'grocery':
        return 'List your ingredients or ask about recipes...';
      case 'learning':
        return 'What would you like to learn?';
      case 'process':
        return 'What process do you need help with?';
      default:
        return 'Type your message...';
    }
  };

  const getCategoryEmoji = () => {
    switch (currentCategory) {
      case 'grocery': return '🥬';
      case 'learning': return '📚';
      case 'process': return '✈️';
      case 'reminder': return '⏰';
      default: return '💬';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-dark-950">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-dark-800 bg-dark-900/50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getCategoryEmoji()}</span>
          <div>
            <h2 className="font-medium text-white capitalize">
              {currentCategory || 'Welcome'}
            </h2>
            <p className="text-xs text-dark-400">
              {currentCategory 
                ? `Managing your ${currentCategory} tasks`
                : 'Select a category to begin'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <EmptyState category={currentCategory} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isLatest={index === messages.length - 1}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-dark-800 bg-dark-900/50">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={!currentCategory || isLoading}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-dark-850 border border-dark-700 rounded-xl
                       text-white placeholder-dark-500 resize-none
                       focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-smooth"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !currentCategory}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2
                       text-dark-400 hover:text-accent disabled:text-dark-600
                       disabled:cursor-not-allowed transition-smooth"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-dark-500 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message, isLatest }: { message: Message; isLatest: boolean }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isLatest ? 'message-enter' : ''}`}
    >
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl
                  ${isUser 
                    ? 'bg-accent text-dark-950 rounded-br-md' 
                    : 'bg-dark-800 text-dark-100 rounded-bl-md border border-dark-700'
                  }`}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <FormattedMessage content={message.content} />
        </div>
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  // Simple markdown-like formatting
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, i) => {
        // Bold text
        let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic text
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // Check for bullet points
        if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
          return (
            <div key={i} className="pl-2 py-0.5" dangerouslySetInnerHTML={{ __html: formatted }} />
          );
        }
        
        // Check for numbered lists
        if (/^\d+\./.test(line.trim())) {
          return (
            <div key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: formatted }} />
          );
        }
        
        // Empty line
        if (!line.trim()) {
          return <div key={i} className="h-2" />;
        }
        
        return (
          <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: formatted }} />
        );
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-dark-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-dark-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-dark-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ category }: { category: CategoryType | null }) {
  if (!category) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-4 block">👋</span>
          <h2 className="text-xl font-semibold text-white mb-2">
            Welcome to Smart Kanban
          </h2>
          <p className="text-dark-400">
            Select a category from the sidebar to get started. I'll help you plan, organize, and remember everything!
          </p>
        </div>
      </div>
    );
  }

  const emptyStates = {
    grocery: {
      emoji: '🥬',
      title: 'Grocery Planning',
      description: "Tell me what's in your pantry, and I'll suggest recipes and create shopping lists for you!",
    },
    learning: {
      emoji: '📚',
      title: 'Learning Roadmaps',
      description: "Tell me what you want to learn, and I'll create a personalized study plan with daily reminders.",
    },
    process: {
      emoji: '✈️',
      title: 'Process Planning',
      description: "Need a visa? Planning a trip? I'll break down complex processes into manageable steps.",
    },
    reminder: {
      emoji: '⏰',
      title: 'Smart Reminders',
      description: 'Set up reminders that adapt to your schedule and help you stay on track.',
    },
  };

  const state = emptyStates[category];

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md animate-fade-in">
        <span className="text-6xl mb-4 block">{state.emoji}</span>
        <h2 className="text-xl font-semibold text-white mb-2">{state.title}</h2>
        <p className="text-dark-400">{state.description}</p>
      </div>
    </div>
  );
}
