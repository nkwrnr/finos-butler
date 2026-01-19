'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const thirdInputRef = useRef<HTMLInputElement>(null);
  const fourthInputRef = useRef<HTMLInputElement>(null);
  const inputRefs = [firstInputRef, secondInputRef, thirdInputRef, fourthInputRef];
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  // Focus first input on mount
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Move to next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3 && newPin.every(d => d !== '')) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    if (!/^\d+$/.test(pastedData)) return;

    const newPin = [...pin];
    for (let i = 0; i < pastedData.length && i < 4; i++) {
      newPin[i] = pastedData[i];
    }
    setPin(newPin);

    if (newPin.every(d => d !== '')) {
      handleSubmit(newPin.join(''));
    } else {
      inputRefs[Math.min(pastedData.length, 3)].current?.focus();
    }
  };

  const handleSubmit = async (pinValue: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(from);
        router.refresh();
      } else {
        setError(data.error || 'Invalid PIN');
        setPin(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } catch {
      setError('Connection error. Please try again.');
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-zcash/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zcash"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary">Butler</h1>
          <p className="text-secondary mt-2">Enter your PIN to continue</p>
        </div>

        {/* PIN Input */}
        <div className="flex justify-center gap-3 mb-6">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className="w-14 h-14 text-center text-2xl font-bold bg-elevated border border-border rounded-xl text-primary focus:outline-none focus:border-zcash focus:ring-1 focus:ring-zcash transition disabled:opacity-50"
              autoComplete="off"
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center text-negative text-sm mb-4">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-secondary">
              <div className="w-2 h-2 bg-zcash rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-zcash rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-zcash rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-tertiary text-xs mt-6">
        Personal Finance Dashboard
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-sm">
          <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl animate-pulse">
            <div className="h-16 w-16 bg-elevated rounded-full mx-auto mb-4" />
            <div className="h-8 bg-elevated rounded w-24 mx-auto mb-2" />
            <div className="h-4 bg-elevated rounded w-48 mx-auto" />
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
