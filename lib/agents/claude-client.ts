import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Send a message to Claude for analysis.
 * Uses claude-sonnet-4-20250514 for cost-effective analysis.
 */
export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<ClaudeResponse> {
  const { maxTokens = 2000, temperature = 0.7 } = options;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textContent = response.content.find((c) => c.type === 'text');

  return {
    content: textContent && textContent.type === 'text' ? textContent.text : '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Ask Claude to generate structured JSON output.
 */
export async function askClaudeForJson<T>(
  systemPrompt: string,
  userMessage: string,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<T | null> {
  const response = await askClaude(
    systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.',
    userMessage,
    { ...options, temperature: 0.3 } // Lower temp for structured output
  );

  try {
    // Try to extract JSON from response
    let jsonStr = response.content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    return JSON.parse(jsonStr.trim()) as T;
  } catch (e) {
    console.error('Failed to parse Claude JSON response:', e);
    console.error('Raw response:', response.content);
    return null;
  }
}
