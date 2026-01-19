import Anthropic from '@anthropic-ai/sdk';
import { SpendingCategory } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface LLMCategorizationResult {
  category: SpendingCategory;
  merchantName: string;
  confidence: 'high' | 'medium' | 'low';
}

interface LLMResponse {
  index: number;
  category: string;
  merchant_name: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Batch categorize transactions using Claude for efficiency (max 25 at a time)
 */
export async function categorizeBatchWithLLM(
  transactions: { id: number; description: string; amount: number }[]
): Promise<Map<number, LLMCategorizationResult>> {
  if (transactions.length === 0) {
    return new Map();
  }

  const transactionList = transactions
    .map((t, i) => `${i + 1}. "${t.description}" ($${Math.abs(t.amount).toFixed(2)})`)
    .join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are a financial transaction categorizer. Analyze bank transaction descriptions and determine:
1. The spending category
2. A clean merchant name (e.g., "CHIPOTLE MEXICAN GRI 12345" → "Chipotle")

Categories (use exactly these):
- groceries: Supermarkets, grocery stores, food markets
- gas: Gas stations, EV charging
- dining: Restaurants, fast food, coffee shops, bars, food delivery
- shopping: Retail, Amazon, clothing, electronics, general merchandise
- entertainment: Streaming, movies, games, concerts, events, hobbies
- subscriptions: Software subscriptions, digital services, memberships
- transportation: Uber, Lyft, parking, tolls, public transit
- auto: Car repairs, maintenance, DMV, car wash
- utilities: Electric, gas, water, internet, phone
- healthcare: Doctor, pharmacy, medical, dental, vision
- personal_care: Gym, haircuts, spa, beauty
- home: Furniture, home improvement, household items
- travel: Hotels, flights, vacation expenses
- education: Books, courses, learning
- pets: Pet food, vet, pet supplies
- gifts: Presents, donations
- fees: Bank fees, interest charges
- insurance: Insurance payments
- uncategorized: Cannot determine (use sparingly)

Bank descriptions are often truncated, mangled, or contain codes. Use your knowledge of merchants to identify them.

Examples:
- "PURCHASE AUTHORIZED ON 12/18 CHEVRON 0123456 SANTA MONICA CA" → gas, "Chevron"
- "AMZN MKTP US*2J3K4L5" → shopping, "Amazon"
- "SQ *SWEETGREEN LOS AN" → dining, "Sweetgreen"
- "PURCHASE AUTHORIZED ON 01/05 WHOLEFDS MKT 12345" → groceries, "Whole Foods"
- "RECURRING PAYMENT AUTHORIZED ON 01/13 DNH*GODADDY" → subscriptions, "GoDaddy"
- "SO CAL EDISON CO DIRECTPAY" → utilities, "SoCal Edison"

Respond with JSON array only, no other text:
[{"index": 1, "category": "...", "merchant_name": "...", "confidence": "high|medium|low"}, ...]`,
      messages: [{
        role: 'user',
        content: `Categorize these transactions:\n${transactionList}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse LLM response:', text);
      return new Map();
    }

    const results: LLMResponse[] = JSON.parse(jsonMatch[0]);
    const resultMap = new Map<number, LLMCategorizationResult>();

    for (const r of results) {
      const tx = transactions[r.index - 1];
      if (tx) {
        // Validate category
        const validCategories: SpendingCategory[] = [
          'groceries', 'gas', 'utilities', 'healthcare', 'insurance',
          'dining', 'shopping', 'entertainment', 'subscriptions', 'personal_care',
          'transportation', 'auto', 'home', 'travel', 'education', 'pets', 'gifts',
          'fees', 'uncategorized'
        ];

        const category = validCategories.includes(r.category as SpendingCategory)
          ? (r.category as SpendingCategory)
          : 'uncategorized';

        resultMap.set(tx.id, {
          category,
          merchantName: r.merchant_name || 'Unknown',
          confidence: r.confidence || 'medium'
        });
      }
    }

    return resultMap;
  } catch (e) {
    console.error('LLM categorization error:', e);
    return new Map();
  }
}
