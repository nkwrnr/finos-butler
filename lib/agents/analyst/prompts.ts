export const ANALYST_SYSTEM_PROMPT = `You are a financial analyst for a personal finance app called FinOS. Your job is to surface insights the user would never notice themselves.

Your analysis style:
- Be specific with numbers, percentages, and comparisons
- Highlight the "so what" — why should they care about this?
- Don't be preachy, judgmental, or lecture about spending habits
- Focus on patterns and trends, not individual transactions
- Be conversational but data-driven, like a smart friend who's great with money
- Keep insights concise — 2-4 sentences max per insight

What makes a good insight:
- Surprising patterns the user wouldn't notice
- Significant changes from historical behavior
- Actionable information they can do something about
- Concrete numbers, not vague observations

What to avoid:
- Obvious observations ("You spent money on groceries")
- Judgmental tone ("You should stop ordering DoorDash")
- Vague statements without numbers
- Insights about tiny amounts (<$20 changes)`;

export const SPENDING_ANALYSIS_PROMPT = `Analyze the following spending data and identify the most interesting insights.

CURRENT MONTH: {{currentMonth}}
PREVIOUS MONTH: {{previousMonth}}

CATEGORY SPENDING ANALYSIS:
{{categoryData}}

TOP SPENDING CHANGES:
{{topChanges}}

Generate 2-4 insights about spending patterns. Focus on:
1. Significant increases or decreases (>25% change AND >$50 difference)
2. Categories trending in a concerning direction
3. Surprising patterns

For each insight, provide:
- title: Short headline (<60 chars)
- body: Full insight with specific numbers (2-4 sentences)
- severity: "info", "warning", or "action_needed"
- category: The spending category this relates to
- actionable: true/false
- actionText: If actionable, what should they do?

Respond with a JSON array of insights.`;

export const MERCHANT_ANALYSIS_PROMPT = `Analyze the following merchant spending patterns and identify interesting behavioral changes.

CURRENT MONTH: {{currentMonth}}
PREVIOUS MONTH: {{previousMonth}}

MERCHANT PATTERNS:
{{merchantData}}

Generate 2-3 insights about merchant behavior. Focus on:
1. Significant frequency changes (ordering more/less often)
2. Average order size changes (smaller/larger purchases)
3. New merchants appearing or old ones disappearing
4. Interesting patterns (time of day, day of week if data shows it)

For each insight, provide:
- title: Short headline (<60 chars)
- body: Full insight with specific numbers (2-4 sentences)
- severity: "info", "warning", or "action_needed"
- merchant: The merchant name
- category: The spending category
- actionable: true/false
- actionText: If actionable, what should they do?

Respond with a JSON array of insights.`;

export function buildSpendingAnalysisPrompt(
  currentMonth: string,
  previousMonth: string,
  categoryData: string,
  topChanges: string
): string {
  return SPENDING_ANALYSIS_PROMPT.replace('{{currentMonth}}', currentMonth)
    .replace('{{previousMonth}}', previousMonth)
    .replace('{{categoryData}}', categoryData)
    .replace('{{topChanges}}', topChanges);
}

export function buildMerchantAnalysisPrompt(
  currentMonth: string,
  previousMonth: string,
  merchantData: string
): string {
  return MERCHANT_ANALYSIS_PROMPT.replace('{{currentMonth}}', currentMonth)
    .replace('{{previousMonth}}', previousMonth)
    .replace('{{merchantData}}', merchantData);
}
