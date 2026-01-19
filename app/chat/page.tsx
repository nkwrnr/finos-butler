'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ContextSummary {
  checkingBalance: number;
  available: number;
  daysUntilPay: number;
  dailyBudget: number;
}

const QUICK_ACTIONS = [
  { label: 'Can I afford...', prompt: 'Can I afford ' },
  { label: "How am I doing?", prompt: "How am I doing this month?" },
  { label: 'Daily budget', prompt: "What's my daily budget?" },
  { label: 'Buy Zcash?', prompt: "Should I buy Zcash today?" },
  { label: 'Which card?', prompt: "Which card should I use for " },
];

const INITIAL_GREETING = `Hey! I'm Butler, your financial assistant. I have access to all your accounts, transactions, and goals. Ask me anything about your finances - like "Can I afford dinner out tonight?" or "How am I doing this month?"`;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'assistant',
      content: INITIAL_GREETING,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<ContextSummary | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build conversation history (exclude greeting)
      const conversationHistory = messages
        .filter(m => m.id !== 'greeting')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          conversationHistory,
        }),
      });

      const data = await response.json();

      if (data.success && data.response) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        if (data.context) {
          setContext(data.context);
        }
      } else {
        // Error response
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${data.error || 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (prompt: string) => {
    if (prompt.endsWith(' ')) {
      // Prompt needs completion - put in input
      setInput(prompt);
      inputRef.current?.focus();
    } else {
      // Complete prompt - send immediately
      sendMessage(prompt);
    }
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)]">
      {/* Header with context summary */}
      <div className="flex-shrink-0 pb-3 md:pb-4 border-b border-border mb-3 md:mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <h1 className="text-xl md:text-2xl font-semibold text-primary">Chat with Butler</h1>
          {context && (
            <div className="hidden md:flex gap-6 text-sm">
              <div>
                <span className="text-secondary">Available</span>
                <span className="ml-2 text-positive font-medium">${formatCurrency(context.available)}</span>
              </div>
              <div>
                <span className="text-secondary">Daily Budget</span>
                <span className="ml-2 font-medium text-primary">${Math.round(context.dailyBudget)}</span>
              </div>
              <div>
                <span className="text-secondary">Payday in</span>
                <span className="ml-2 font-medium text-primary">{context.daysUntilPay} days</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pb-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] md:max-w-[80%] rounded-xl px-3 md:px-4 py-2 md:py-3 ${
                message.role === 'user'
                  ? 'bg-zcash text-base'
                  : 'bg-surface border border-border text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm md:text-base">{message.content}</p>
              <p className={`text-xs mt-1 md:mt-2 ${message.role === 'user' ? 'text-base/70' : 'text-tertiary'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="flex-shrink-0 py-3 border-t border-border">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {QUICK_ACTIONS.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={loading}
              className="flex-shrink-0 px-3 py-1.5 bg-elevated border border-border rounded-lg text-sm text-secondary hover:text-primary hover:border-tertiary transition disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 pt-2">
        <div className="flex gap-2 md:gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your finances..."
            disabled={loading}
            className="flex-1 bg-surface border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-primary placeholder-tertiary focus:outline-none focus:border-zcash focus:ring-1 focus:ring-zcash transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 md:px-6 py-2.5 md:py-3 bg-zcash text-base rounded-xl text-sm md:text-base font-medium hover:bg-zcash/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
