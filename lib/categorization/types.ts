// Spending categories for Level 2 categorization
export type SpendingCategory =
  // Essentials
  | 'groceries'        // Supermarkets, grocery stores, Costco food
  | 'gas'              // Gas stations, EV charging
  | 'utilities'        // Electric, gas, water, internet, phone
  | 'healthcare'       // Doctor, dentist, pharmacy, therapy, medical
  | 'insurance'        // Auto, health, renters, life

  // Lifestyle
  | 'dining'           // Restaurants, fast food, coffee, bars, delivery
  | 'shopping'         // Amazon, retail, clothing, electronics, general
  | 'entertainment'    // Streaming, movies, games, concerts, sports, hobbies
  | 'subscriptions'    // Software, memberships, digital services (non-streaming)
  | 'personal_care'    // Haircuts, gym, spa, beauty, grooming

  // Transportation
  | 'transportation'   // Uber, Lyft, parking, tolls, public transit
  | 'auto'             // Car repairs, maintenance, parts, car wash, DMV

  // Home & Life
  | 'home'             // Furniture, home improvement, cleaning, appliances
  | 'travel'           // Hotels, flights, Airbnb, vacation expenses
  | 'education'        // Books, courses, tuition, learning
  | 'pets'             // Pet food, vet, pet supplies
  | 'gifts'            // Presents, donations, charity

  // Financial
  | 'fees'             // Bank fees, ATM fees, interest charges, service fees

  // Catch-all
  | 'uncategorized';   // Needs manual review

export const SPENDING_CATEGORIES: SpendingCategory[] = [
  'groceries', 'gas', 'utilities', 'healthcare', 'insurance',
  'dining', 'shopping', 'entertainment', 'subscriptions', 'personal_care',
  'transportation', 'auto', 'home', 'travel', 'education', 'pets', 'gifts',
  'fees', 'uncategorized'
];

export const CATEGORY_DISPLAY_NAMES: Record<SpendingCategory, string> = {
  groceries: 'Groceries',
  gas: 'Gas',
  utilities: 'Utilities',
  healthcare: 'Healthcare',
  insurance: 'Insurance',
  dining: 'Dining & Food',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  subscriptions: 'Subscriptions',
  personal_care: 'Personal Care',
  transportation: 'Transportation',
  auto: 'Auto & Car',
  home: 'Home',
  travel: 'Travel',
  education: 'Education',
  pets: 'Pets',
  gifts: 'Gifts & Donations',
  fees: 'Fees',
  uncategorized: 'Uncategorized'
};

export interface MerchantMatch {
  category: SpendingCategory;
  merchantName: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CategorizationStats {
  total: number;
  byRule: number;
  byLLM: number;
  alreadyCategorized: number;
  failed: number;
}
