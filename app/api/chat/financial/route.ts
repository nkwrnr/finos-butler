import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildFinancialContext, getContextSummary } from '@/lib/chat/financial-context';
import { buildSystemPrompt } from '@/lib/chat/system-prompt';

// Message type for conversation history
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Request body type
interface ChatRequest {
  message: string;
  conversationHistory?: ChatMessage[];
}

// Response type
interface ChatResponse {
  success: boolean;
  response?: string;
  context?: {
    checkingBalance: number;
    available: number;
    daysUntilPay: number;
    dailyBudget: number;
  };
  error?: string;
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    // Parse request body
    const body: ChatRequest = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // Build fresh financial context
    const context = await buildFinancialContext();
    const systemPrompt = buildSystemPrompt(context);

    // Build messages array for Claude
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Extract text response
    const textContent = response.content.find(block => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Return response with context summary
    return NextResponse.json({
      success: true,
      response: responseText,
      context: getContextSummary(context),
    });

  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { success: false, error: `API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
