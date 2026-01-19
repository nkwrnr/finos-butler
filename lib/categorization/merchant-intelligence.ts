import { SpendingCategory, MerchantMatch } from './types';

interface MerchantPattern {
  pattern: RegExp;
  category: SpendingCategory;
  name: string;
}

// Known merchant patterns with smart matching
// Key insight: Bank descriptions are mangled, truncated, and inconsistent
// We need fuzzy matching and pattern recognition
const MERCHANT_PATTERNS: MerchantPattern[] = [
  // === GAS STATIONS ===
  { pattern: /chevron/i, category: 'gas', name: 'Chevron' },
  { pattern: /shell\s*(oil|gas)?/i, category: 'gas', name: 'Shell' },
  { pattern: /exxon|mobil/i, category: 'gas', name: 'Exxon Mobil' },
  { pattern: /arco/i, category: 'gas', name: 'ARCO' },
  { pattern: /76\s*(gas|station)?/i, category: 'gas', name: '76' },
  { pattern: /\bbp\b/i, category: 'gas', name: 'BP' },
  { pattern: /speedway/i, category: 'gas', name: 'Speedway' },
  { pattern: /circle\s*k/i, category: 'gas', name: 'Circle K' },
  { pattern: /7-?eleven.*fuel/i, category: 'gas', name: '7-Eleven' },
  { pattern: /costco\s*(gas|fuel)/i, category: 'gas', name: 'Costco Gas' },
  { pattern: /sam'?s\s*(club)?\s*(fuel|gas)/i, category: 'gas', name: "Sam's Club Gas" },
  { pattern: /wawa.*fuel/i, category: 'gas', name: 'Wawa' },
  { pattern: /racetrac/i, category: 'gas', name: 'RaceTrac' },
  { pattern: /quick\s*trip|qt\s/i, category: 'gas', name: 'QuikTrip' },
  { pattern: /ev\s*charging|chargepoint|electrify|tesla\s*super/i, category: 'gas', name: 'EV Charging' },
  { pattern: /valero/i, category: 'gas', name: 'Valero' },
  { pattern: /sunoco/i, category: 'gas', name: 'Sunoco' },
  { pattern: /marathon\s*(gas|petro)/i, category: 'gas', name: 'Marathon' },
  { pattern: /phillips\s*66/i, category: 'gas', name: 'Phillips 66' },

  // === GROCERIES ===
  { pattern: /whole\s*foods/i, category: 'groceries', name: 'Whole Foods' },
  { pattern: /trader\s*joe/i, category: 'groceries', name: "Trader Joe's" },
  { pattern: /safeway/i, category: 'groceries', name: 'Safeway' },
  { pattern: /kroger/i, category: 'groceries', name: 'Kroger' },
  { pattern: /ralphs/i, category: 'groceries', name: 'Ralphs' },
  { pattern: /vons/i, category: 'groceries', name: 'Vons' },
  { pattern: /albertson/i, category: 'groceries', name: 'Albertsons' },
  { pattern: /publix/i, category: 'groceries', name: 'Publix' },
  { pattern: /\baldi\b/i, category: 'groceries', name: 'Aldi' },
  { pattern: /sprouts/i, category: 'groceries', name: 'Sprouts' },
  { pattern: /h-?e-?b\s/i, category: 'groceries', name: 'H-E-B' },
  { pattern: /wegmans/i, category: 'groceries', name: 'Wegmans' },
  { pattern: /food\s*(lion|4\s*less|maxx)/i, category: 'groceries', name: 'Food Store' },
  { pattern: /grocery|supermarket/i, category: 'groceries', name: 'Grocery Store' },
  { pattern: /instacart/i, category: 'groceries', name: 'Instacart' },
  { pattern: /costco(?!\s*(gas|fuel))/i, category: 'groceries', name: 'Costco' },
  { pattern: /smart\s*&\s*final/i, category: 'groceries', name: 'Smart & Final' },
  { pattern: /food\s*co-?op/i, category: 'groceries', name: 'Food Co-op' },
  { pattern: /stage\s*stop\s*market/i, category: 'groceries', name: 'Stage Stop Market' },
  { pattern: /market|grocer/i, category: 'groceries', name: 'Market' },

  // === DINING ===
  { pattern: /starbucks/i, category: 'dining', name: 'Starbucks' },
  { pattern: /chipotle/i, category: 'dining', name: 'Chipotle' },
  { pattern: /mcdonald/i, category: 'dining', name: "McDonald's" },
  { pattern: /chick-?fil-?a/i, category: 'dining', name: 'Chick-fil-A' },
  { pattern: /taco\s*bell/i, category: 'dining', name: 'Taco Bell' },
  { pattern: /wendy'?s/i, category: 'dining', name: "Wendy's" },
  { pattern: /burger\s*king/i, category: 'dining', name: 'Burger King' },
  { pattern: /\bsubway\b/i, category: 'dining', name: 'Subway' },
  { pattern: /panera/i, category: 'dining', name: 'Panera' },
  { pattern: /panda\s*express/i, category: 'dining', name: 'Panda Express' },
  { pattern: /five\s*guys/i, category: 'dining', name: 'Five Guys' },
  { pattern: /in-?n-?out/i, category: 'dining', name: 'In-N-Out' },
  { pattern: /sweetgreen/i, category: 'dining', name: 'Sweetgreen' },
  { pattern: /\bcava\b/i, category: 'dining', name: 'Cava' },
  { pattern: /doordash/i, category: 'dining', name: 'DoorDash' },
  { pattern: /uber\s*eats/i, category: 'dining', name: 'Uber Eats' },
  { pattern: /grubhub/i, category: 'dining', name: 'Grubhub' },
  { pattern: /postmates/i, category: 'dining', name: 'Postmates' },
  { pattern: /seamless/i, category: 'dining', name: 'Seamless' },
  { pattern: /caviar/i, category: 'dining', name: 'Caviar' },
  { pattern: /pizza\s*hut|domino|papa\s*john/i, category: 'dining', name: 'Pizza Delivery' },
  { pattern: /dunkin/i, category: 'dining', name: 'Dunkin' },
  { pattern: /coffee|cafe|bakery/i, category: 'dining', name: 'Coffee/Cafe' },
  { pattern: /restaurant|grill|kitchen|bistro|tavern|bar\s*&|pub\s|\bdeli\b/i, category: 'dining', name: 'Restaurant' },
  { pattern: /mexica/i, category: 'dining', name: 'Mexican Restaurant' },
  { pattern: /carmelita/i, category: 'dining', name: "Carmelita's" },
  { pattern: /carlee/i, category: 'dining', name: "Carlee's" },
  { pattern: /wingstop/i, category: 'dining', name: 'Wingstop' },
  { pattern: /jack\s*in\s*the\s*box/i, category: 'dining', name: 'Jack in the Box' },
  { pattern: /sonic\s*drive/i, category: 'dining', name: 'Sonic' },
  { pattern: /el\s*pollo/i, category: 'dining', name: 'El Pollo Loco' },
  { pattern: /del\s*taco/i, category: 'dining', name: 'Del Taco' },
  { pattern: /kfc/i, category: 'dining', name: 'KFC' },
  { pattern: /popeyes/i, category: 'dining', name: 'Popeyes' },
  { pattern: /jersey\s*mike/i, category: 'dining', name: "Jersey Mike's" },
  { pattern: /jimmy\s*john/i, category: 'dining', name: "Jimmy John's" },

  // === SHOPPING ===
  { pattern: /amazon(?!\s*prime\s*video).*mktpl|amzn/i, category: 'shopping', name: 'Amazon' },
  { pattern: /amazon\.com/i, category: 'shopping', name: 'Amazon' },
  { pattern: /target(?!\s*optical)/i, category: 'shopping', name: 'Target' },
  { pattern: /walmart(?!\s*(gas|fuel))/i, category: 'shopping', name: 'Walmart' },
  { pattern: /best\s*buy/i, category: 'shopping', name: 'Best Buy' },
  { pattern: /apple\.com|apple\s*store/i, category: 'shopping', name: 'Apple' },
  { pattern: /\bebay\b/i, category: 'shopping', name: 'eBay' },
  { pattern: /etsy/i, category: 'shopping', name: 'Etsy' },
  { pattern: /tj\s*maxx|marshalls|homegoods/i, category: 'shopping', name: 'TJX' },
  { pattern: /nordstrom/i, category: 'shopping', name: 'Nordstrom' },
  { pattern: /macy'?s/i, category: 'shopping', name: "Macy's" },
  { pattern: /nike|adidas|lululemon/i, category: 'shopping', name: 'Athletic Apparel' },
  { pattern: /ross\s*dress/i, category: 'shopping', name: 'Ross' },
  { pattern: /dollar\s*tree|dollar\s*general/i, category: 'shopping', name: 'Dollar Store' },
  { pattern: /michaels(?!\s*in)/i, category: 'shopping', name: 'Michaels' },
  { pattern: /michaels\s*in/i, category: 'shopping', name: 'Michaels' },
  { pattern: /paypal/i, category: 'shopping', name: 'PayPal Purchase' },

  // === HOME ===
  { pattern: /wayfair/i, category: 'home', name: 'Wayfair' },
  { pattern: /ikea/i, category: 'home', name: 'IKEA' },
  { pattern: /home\s*depot/i, category: 'home', name: 'Home Depot' },
  { pattern: /lowe'?s/i, category: 'home', name: "Lowe's" },
  { pattern: /bed\s*bath/i, category: 'home', name: 'Bed Bath & Beyond' },
  { pattern: /container\s*store/i, category: 'home', name: 'Container Store' },
  { pattern: /ace\s*hardware/i, category: 'home', name: 'Ace Hardware' },
  { pattern: /pottery\s*barn/i, category: 'home', name: 'Pottery Barn' },
  { pattern: /williams\s*sonoma/i, category: 'home', name: 'Williams Sonoma' },
  { pattern: /crate\s*&?\s*barrel/i, category: 'home', name: 'Crate & Barrel' },

  // === TRANSPORTATION ===
  { pattern: /uber(?!\s*eats)/i, category: 'transportation', name: 'Uber' },
  { pattern: /lyft/i, category: 'transportation', name: 'Lyft' },
  { pattern: /parking|park\s*mobile|spot\s*hero/i, category: 'transportation', name: 'Parking' },
  { pattern: /toll|fastrak|e-?z\s*pass/i, category: 'transportation', name: 'Tolls' },
  { pattern: /metro|subway|transit|mta|bart|caltrain/i, category: 'transportation', name: 'Public Transit' },

  // === AUTO ===
  { pattern: /dmv|dept.*motor/i, category: 'auto', name: 'DMV' },
  { pattern: /jiffy\s*lube|valvoline|oil\s*change/i, category: 'auto', name: 'Oil Change' },
  { pattern: /autozone|o'?reilly|napa|pep\s*boys/i, category: 'auto', name: 'Auto Parts' },
  { pattern: /car\s*wash/i, category: 'auto', name: 'Car Wash' },
  { pattern: /audi|bmw|mercedes|toyota|honda|ford.*service|dealer/i, category: 'auto', name: 'Auto Service' },
  { pattern: /tire/i, category: 'auto', name: 'Tire Service' },

  // === UTILITIES ===
  { pattern: /edison|pge|pg&e|power|electric/i, category: 'utilities', name: 'Electric' },
  { pattern: /so\s*cal\s*(gas|edison)/i, category: 'utilities', name: 'SoCal Utility' },
  { pattern: /socal\s*gas|gas\s*company/i, category: 'utilities', name: 'Gas Utility' },
  { pattern: /water\s*(dept|district|utility)/i, category: 'utilities', name: 'Water' },
  { pattern: /verizon|at&?t|t-?mobile|sprint/i, category: 'utilities', name: 'Phone' },
  { pattern: /spectrum|comcast|xfinity|cox/i, category: 'utilities', name: 'Internet/Cable' },

  // === ENTERTAINMENT / SUBSCRIPTIONS ===
  { pattern: /netflix/i, category: 'entertainment', name: 'Netflix' },
  { pattern: /spotify/i, category: 'entertainment', name: 'Spotify' },
  { pattern: /hulu/i, category: 'entertainment', name: 'Hulu' },
  { pattern: /disney\s*\+|disneyplus/i, category: 'entertainment', name: 'Disney+' },
  { pattern: /hbo\s*max|max\.com/i, category: 'entertainment', name: 'HBO Max' },
  { pattern: /apple\s*(tv|music|one)/i, category: 'entertainment', name: 'Apple Services' },
  { pattern: /amazon\s*prime\s*video|prime\s*video/i, category: 'entertainment', name: 'Prime Video' },
  { pattern: /youtube\s*(premium|tv)/i, category: 'entertainment', name: 'YouTube' },
  { pattern: /paramount/i, category: 'entertainment', name: 'Paramount+' },
  { pattern: /peacock/i, category: 'entertainment', name: 'Peacock' },
  { pattern: /audible/i, category: 'entertainment', name: 'Audible' },
  { pattern: /playstation|xbox|nintendo|steam/i, category: 'entertainment', name: 'Gaming' },
  { pattern: /gametime|stubhub|ticketmaster|axs|eventbrite/i, category: 'entertainment', name: 'Tickets/Events' },
  { pattern: /amc|regal|cinemark|movie/i, category: 'entertainment', name: 'Movies' },

  // Subscriptions (non-streaming)
  { pattern: /openai/i, category: 'subscriptions', name: 'OpenAI' },
  { pattern: /elevenlabs/i, category: 'subscriptions', name: 'ElevenLabs' },
  { pattern: /notion/i, category: 'subscriptions', name: 'Notion' },
  { pattern: /dropbox/i, category: 'subscriptions', name: 'Dropbox' },
  { pattern: /google\s*(one|storage|workspace)/i, category: 'subscriptions', name: 'Google' },
  { pattern: /icloud/i, category: 'subscriptions', name: 'iCloud' },
  { pattern: /adobe/i, category: 'subscriptions', name: 'Adobe' },
  { pattern: /microsoft\s*365|office\s*365/i, category: 'subscriptions', name: 'Microsoft 365' },
  { pattern: /github/i, category: 'subscriptions', name: 'GitHub' },
  { pattern: /x\.com|twitter/i, category: 'subscriptions', name: 'X (Twitter)' },
  { pattern: /godaddy/i, category: 'subscriptions', name: 'GoDaddy' },
  { pattern: /monarch\s*money/i, category: 'subscriptions', name: 'Monarch Money' },
  { pattern: /apple\.com\/bill/i, category: 'subscriptions', name: 'Apple Subscription' },

  // === HEALTHCARE ===
  { pattern: /cvs/i, category: 'healthcare', name: 'CVS' },
  { pattern: /walgreens/i, category: 'healthcare', name: 'Walgreens' },
  { pattern: /rite\s*aid/i, category: 'healthcare', name: 'Rite Aid' },
  { pattern: /pharmacy|rx\s|prescri/i, category: 'healthcare', name: 'Pharmacy' },
  { pattern: /doctor|dr\.|physician|medical|clinic|health/i, category: 'healthcare', name: 'Medical' },
  { pattern: /dentist|dental/i, category: 'healthcare', name: 'Dental' },
  { pattern: /optom|vision|eyecare|lenscrafters/i, category: 'healthcare', name: 'Vision' },
  { pattern: /therapy|therapist|counseling/i, category: 'healthcare', name: 'Therapy' },

  // === PERSONAL CARE ===
  { pattern: /gym|fitness|planet\s*fitness|equinox|la\s*fitness|24\s*hour/i, category: 'personal_care', name: 'Gym' },
  { pattern: /salon|haircut|barber|supercuts|great\s*clips/i, category: 'personal_care', name: 'Haircut' },
  { pattern: /spa|massage|nail/i, category: 'personal_care', name: 'Spa/Beauty' },
  { pattern: /sephora|ulta|beauty/i, category: 'personal_care', name: 'Beauty' },

  // === TRAVEL ===
  { pattern: /airline|united|delta|american\s*air|southwest|jetblue|alaska\s*air/i, category: 'travel', name: 'Airline' },
  { pattern: /hotel|marriott|hilton|hyatt|airbnb|vrbo/i, category: 'travel', name: 'Lodging' },
  { pattern: /hertz|avis|enterprise|rental\s*car/i, category: 'travel', name: 'Car Rental' },
  { pattern: /expedia|booking\.com|kayak|priceline/i, category: 'travel', name: 'Travel Booking' },
  { pattern: /tsa\s*pre|global\s*entry|known\s*traveler/i, category: 'travel', name: 'Travel Services' },
  { pattern: /travel\s*credit/i, category: 'travel', name: 'Travel Credit' },

  // === PETS ===
  { pattern: /petco|petsmart|chewy/i, category: 'pets', name: 'Pet Store' },
  { pattern: /vet|veterinar|animal\s*hospital/i, category: 'pets', name: 'Veterinarian' },

  // === EDUCATION ===
  { pattern: /udemy|coursera|skillshare|masterclass|linkedin\s*learn/i, category: 'education', name: 'Online Course' },
  { pattern: /book|kindle|barnes|audible/i, category: 'education', name: 'Books' },

  // === FEES ===
  { pattern: /atm|fee|interest\s*charge|finance\s*charge|late\s*fee/i, category: 'fees', name: 'Fee' },
  { pattern: /overdraft/i, category: 'fees', name: 'Overdraft Fee' },
];

/**
 * Match a transaction description to a known merchant pattern
 */
export function matchMerchant(description: string): MerchantMatch | null {
  const normalized = description.toLowerCase().trim();

  for (const { pattern, category, name } of MERCHANT_PATTERNS) {
    if (pattern.test(normalized)) {
      return { category, merchantName: name, confidence: 'high' };
    }
  }

  return null;
}

/**
 * Get all known patterns for debugging/display
 */
export function getAllPatterns(): { pattern: string; category: SpendingCategory; name: string }[] {
  return MERCHANT_PATTERNS.map(p => ({
    pattern: p.pattern.source,
    category: p.category,
    name: p.name
  }));
}
