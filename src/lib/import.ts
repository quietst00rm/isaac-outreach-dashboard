import * as XLSX from 'xlsx';
import type {
  Prospect,
  PipelineRecord,
  Experience,
  RawWorkingRow,
  RawScrapedRow,
  ICPScoreBreakdown
} from '@/types';

// ============================================================================
// ICP SCORING - Two Segments: Agency Decision-Makers & Merchant Operators
// ============================================================================

// SEGMENT 1: Agency Decision-Makers
// Keywords that indicate an e-commerce/Shopify agency
const AGENCY_KEYWORDS = [
  'shopify', 'shopify plus', 'shopify partner', 'e-commerce agency',
  'ecommerce agency', 'dtc agency', 'e-commerce development',
  'ecommerce development', 'shopify agency', 'shopify expert',
  'e-commerce services', 'ecommerce services', 'digital agency'
];

// ============================================================================
// TITLE AUTHORITY MATCHING
// ============================================================================
//
// CRITICAL BUG FIX (2026-01-20):
// Previous logic used simple .includes() matching, which failed for:
// - "Chief Executive Officer" (doesn't contain "ceo")
// - "Chief Operating Officer" (doesn't contain "coo")
// - Title variations like "CEO & Founder", "Co-Founder & CEO"
//
// NEW LOGIC: We now match against full spelled-out titles AND abbreviations.
// All title matching is case-insensitive (titles are lowercased before comparison).
// ============================================================================

// Highest priority agency titles (decision-makers)
// These all score +40 points
const AGENCY_TOP_TITLES = [
  // CEO variations
  'ceo', 'chief executive officer', 'chief executive',
  // Founder variations
  'founder', 'co-founder', 'cofounder', 'co founder',
  // Owner
  'owner',
  // COO variations
  'coo', 'chief operating officer', 'chief operating',
  // President (when it implies CEO-level authority)
  'president',
  // Managing Partner
  'managing partner',
  // Partnership roles for agencies
  'director of partnerships', 'partnerships director'
];

// Secondary priority agency titles (+30 points)
const AGENCY_SECONDARY_TITLES = [
  'vp of client services', 'head of partnerships', 'director of client success',
  'client success director', 'vp client services', 'head of client success',
  'partner', 'principal'
];

// SEGMENT 2: Merchant Operators
// Keywords that indicate a DTC/e-commerce brand
const MERCHANT_KEYWORDS = [
  'shopify', 'dtc', 'direct-to-consumer', 'direct to consumer',
  'e-commerce brand', 'ecommerce brand', 'd2c', 'online store',
  'shipping', 'fulfillment', 'physical products', 'consumer brand',
  'retail brand', 'shopify store', 'bigcommerce', 'woocommerce'
];

// Highest priority merchant titles (operators with authority)
// These all score +40 points
const MERCHANT_TOP_TITLES = [
  // CEO variations
  'ceo', 'chief executive officer', 'chief executive',
  // Founder variations
  'founder', 'co-founder', 'cofounder', 'co founder',
  // Owner
  'owner',
  // COO variations
  'coo', 'chief operating officer', 'chief operating',
  // President
  'president',
  // Operations leadership (critical for merchants)
  'vp of operations', 'vp operations', 'vice president of operations',
  'head of operations', 'operations director', 'director of operations',
  // E-commerce leadership
  'head of e-commerce', 'head of ecommerce', 'vp of e-commerce', 'vp of ecommerce',
  'director of e-commerce', 'director of ecommerce'
];

// Secondary merchant titles (+30 points for merchants, +25 for agencies)
const MERCHANT_SECONDARY_TITLES = [
  'operations manager', 'head of fulfillment',
  'director of fulfillment', 'supply chain director', 'head of supply chain',
  'ecommerce manager', 'e-commerce manager'
];

// Product categories (minor boost only - often unreliable)
const PRODUCT_CATEGORIES = [
  'electronics', 'jewelry', 'supplements', 'vitamins', 'fashion',
  'apparel', 'beauty', 'cosmetics', 'skincare', 'health',
  'home goods', 'furniture', 'sporting goods', 'pet supplies',
  'ceramics', 'premium', 'luxury'
];

// ============================================================================
// SEGMENT CLASSIFICATION
// ============================================================================
//
// CRITICAL FIX (2026-01-20):
// Previous logic was too restrictive and classified many legitimate merchants
// as "Unknown" (e.g., Zulay Kitchen CEO, Sera Swimwear Founder).
//
// NEW LOGIC: Use industry-based detection as primary signal, then fall back
// to keyword detection. Default to Merchant rather than Unknown.
//
// Segments: "merchant", "agency", "freelancer" (no more "unknown")
// ============================================================================

// Industries that strongly indicate a MERCHANT (product-based business)
const MERCHANT_INDUSTRIES = [
  'retail', 'consumer goods', 'food & beverages', 'food and beverages',
  'apparel', 'fashion', 'jewelry', 'cosmetics', 'sporting goods',
  'furniture', 'home goods', 'electronics', 'health & wellness',
  'health and wellness', 'consumer products', 'food production',
  'food & beverage', 'consumer services', 'retail apparel',
  'luxury goods', 'textiles', 'household products', 'pet products',
  'beverage', 'personal care', 'beauty', 'toys', 'games',
  'wholesale', 'manufacturing', 'packaging', 'wine and spirits',
  'leisure', 'restaurants', 'hospitality'
];

// Industries that strongly indicate an AGENCY (service-based business)
const AGENCY_INDUSTRIES = [
  'marketing', 'advertising', 'marketing and advertising',
  'public relations', 'design', 'graphic design', 'web design',
  'information technology', 'computer software', 'internet',
  'management consulting', 'business consulting', 'staffing',
  'professional services', 'media production', 'online media'
];

// Keywords in company description/headline that indicate MERCHANT
const MERCHANT_DESCRIPTION_KEYWORDS = [
  'brand', 'products', 'sell', 'shop', 'store', 'e-commerce', 'ecommerce',
  'dtc', 'd2c', 'direct-to-consumer', 'direct to consumer', 'amazon',
  'shopify', 'customers', 'shipping', 'fulfillment', 'orders',
  'manufacturer', 'wholesale', 'retail', 'consumer', 'physical products',
  'kitchen', 'apparel', 'clothing', 'jewelry', 'accessories', 'gear',
  'goods', 'collection', 'designs', 'handmade', 'crafted'
];

// Keywords in company name/description that indicate AGENCY
const AGENCY_DESCRIPTION_KEYWORDS = [
  'agency', 'partner', 'partners', 'consulting', 'consultancy',
  'services', 'solutions', 'help brands', 'work with brands',
  'clients', 'digital marketing', 'growth agency', 'creative agency',
  'marketing agency', 'branding agency', 'ecommerce agency',
  'shopify partner', 'shopify expert', 'shopify agency'
];

// Keywords/patterns that indicate FREELANCER
const FREELANCER_INDICATORS = [
  'self-employed', 'freelance', 'freelancer', 'independent consultant',
  'independent contractor', 'solo', 'solopreneur'
];

/**
 * Detect segment based on industry, keywords, and company info
 * Returns: "merchant", "agency", or "freelancer"
 */
function detectSegment(
  companyName: string,
  industry: string,
  about: string,
  headline: string,
  companySize: string | undefined,
  title: string
): 'merchant' | 'agency' | 'freelancer' {
  const companyLower = companyName.toLowerCase().trim();
  const industryLower = industry.toLowerCase().trim();
  const aboutLower = about.toLowerCase();
  const headlineLower = headline.toLowerCase();
  const titleLower = title.toLowerCase();
  const combinedText = `${companyLower} ${aboutLower} ${headlineLower}`;

  // ============================================================================
  // STEP 1: Check for explicit FREELANCER signals (highest priority)
  // ============================================================================
  const isFreelancerByIndicator = FREELANCER_INDICATORS.some(ind =>
    companyLower.includes(ind) || titleLower.includes(ind) || headlineLower.includes(ind)
  );

  const isNoCompany = !companyLower || companyLower === 'self-employed' ||
    companyLower === 'freelance' || companyLower === 'independent';

  const isSoloBySize = companySize?.toLowerCase().includes('self-employed') ||
    companySize === '1' || companySize?.toLowerCase() === 'myself only';

  if (isFreelancerByIndicator || (isNoCompany && isSoloBySize)) {
    return 'freelancer';
  }

  // ============================================================================
  // STEP 2: Check for AGENCY signals (check before merchant)
  // Agency detection requires strong signals to avoid false positives
  // ============================================================================

  // Industry-based agency detection
  const hasAgencyIndustry = AGENCY_INDUSTRIES.some(ind =>
    industryLower.includes(ind)
  );

  // Keyword-based agency detection
  const hasAgencyKeywords = AGENCY_DESCRIPTION_KEYWORDS.some(kw =>
    combinedText.includes(kw)
  );

  // Company name contains agency indicators
  const companyNameIsAgency = ['agency', 'partners', 'consulting', 'consultancy', 'group', 'studios']
    .some(term => companyLower.includes(term));

  // Strong agency signal: multiple indicators present
  const isAgency = (hasAgencyIndustry && (hasAgencyKeywords || companyNameIsAgency)) ||
    (companyNameIsAgency && hasAgencyKeywords) ||
    (combinedText.includes('clients') && hasAgencyIndustry);

  if (isAgency) {
    return 'agency';
  }

  // ============================================================================
  // STEP 3: Check for MERCHANT signals
  // More lenient - most businesses selling products should be merchants
  // ============================================================================

  // Industry-based merchant detection (strongest signal)
  const hasMerchantIndustry = MERCHANT_INDUSTRIES.some(ind =>
    industryLower.includes(ind)
  );

  // Keyword-based merchant detection
  const hasMerchantKeywords = MERCHANT_DESCRIPTION_KEYWORDS.some(kw =>
    combinedText.includes(kw)
  );

  // Company name suggests product business
  const companyNameIsMerchant = ['brand', 'co.', 'co', 'goods', 'products', 'kitchen',
    'apparel', 'wear', 'gear', 'shop', 'store', 'swimwear', 'jewelry', 'gems']
    .some(term => companyLower.includes(term));

  if (hasMerchantIndustry || hasMerchantKeywords || companyNameIsMerchant) {
    return 'merchant';
  }

  // ============================================================================
  // STEP 4: Tiebreaker logic for unclear cases
  // ============================================================================

  // Has C-suite title + any company = likely a merchant (businesses > agencies)
  const hasCsuiteTtile = ['ceo', 'founder', 'owner', 'president', 'coo', 'chief']
    .some(t => titleLower.includes(t));

  if (hasCsuiteTtile && companyLower && !isNoCompany) {
    // If industry mentions services/consulting, likely agency
    if (industryLower.includes('service') || industryLower.includes('consulting')) {
      return 'agency';
    }
    // Default: C-suite with a company = merchant
    return 'merchant';
  }

  // Has a real company name = default to merchant
  if (companyLower && companyLower.length > 2 && !isNoCompany) {
    return 'merchant';
  }

  // No company or very short company name = freelancer
  return 'freelancer';
}

// Parse company size from string like "11-50 employees" or "51-200"
function parseCompanySize(sizeStr: string | undefined): number | null {
  if (!sizeStr) return null;
  const lower = sizeStr.toLowerCase();

  // Handle common LinkedIn formats
  if (lower.includes('1-10') || lower.includes('2-10') || lower === '1' || lower.includes('self-employed')) return 5;
  if (lower.includes('11-50')) return 30;
  if (lower.includes('51-200')) return 100;
  if (lower.includes('201-500')) return 350;
  if (lower.includes('501-1000') || lower.includes('500+')) return 750;
  if (lower.includes('1001-5000') || lower.includes('1000+')) return 2500;
  if (lower.includes('5001') || lower.includes('10000')) return 7500;

  // Try to parse a number directly
  const match = lower.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);

  return null;
}

export function calculateICPScoreWithBreakdown(prospect: Partial<Prospect>): ICPScoreBreakdown {
  const breakdown: ICPScoreBreakdown = {
    segment: 'merchant', // Default to merchant, will be overwritten by detectSegment
    titleAuthority: 0,
    companySignals: 0,
    companySize: 0,
    productCategory: 0,
    profileCompleteness: 0,
    total: 0
  };

  const title = (prospect.jobTitle || prospect.headline || '').toLowerCase();
  const companyName = (prospect.companyName || '').toLowerCase();
  const about = (prospect.aboutSummary || '').toLowerCase();
  const industry = (prospect.companyIndustry || '').toLowerCase();
  const headline = (prospect.headline || '').toLowerCase();
  const combinedText = `${companyName} ${about} ${headline} ${industry}`;

  // ============================================================================
  // STEP 1: Detect segment using improved classification
  // See detectSegment function for detailed logic
  // ============================================================================
  breakdown.segment = detectSegment(
    prospect.companyName || '',
    prospect.companyIndustry || '',
    prospect.aboutSummary || '',
    prospect.headline || '',
    prospect.companySize,
    prospect.jobTitle || prospect.headline || ''
  );

  // ============================================================================
  // STEP 2: Score title authority (0-40 points)
  // Decision-maker titles are the primary scoring factor
  //
  // MATCHING LOGIC:
  // - All titles are lowercased before comparison
  // - We check if ANY of the target title patterns appear in the full title string
  // - This handles compound titles like "CEO & Founder", "Co-Founder & CEO", etc.
  // - Both abbreviations (CEO) and full forms (Chief Executive Officer) are matched
  // ============================================================================
  const allTopTitles = [...new Set([...AGENCY_TOP_TITLES, ...MERCHANT_TOP_TITLES])];
  const allSecondaryTitles = [...new Set([...AGENCY_SECONDARY_TITLES, ...MERCHANT_SECONDARY_TITLES])];

  // Helper function to check if a title matches any pattern in the list
  // This is more robust than simple includes() for edge cases
  const matchesAnyTitle = (titleStr: string, patterns: string[]): boolean => {
    const normalizedTitle = titleStr.toLowerCase().trim();
    return patterns.some(pattern => {
      const normalizedPattern = pattern.toLowerCase().trim();
      // Check if the pattern appears in the title
      // This handles "CEO & Founder", "Chief Executive Officer at Company", etc.
      return normalizedTitle.includes(normalizedPattern);
    });
  };

  // Score titles the same regardless of segment - title authority is universal
  if (matchesAnyTitle(title, allTopTitles)) {
    breakdown.titleAuthority = 40;
  } else if (matchesAnyTitle(title, allSecondaryTitles)) {
    breakdown.titleAuthority = 30;
  } else if (title.includes('director') || title.includes('head of') || title.includes('vp') || title.includes('vice president')) {
    breakdown.titleAuthority = 20;
  } else if (title.includes('manager') || title.includes('lead') || title.includes('senior')) {
    breakdown.titleAuthority = 10;
  }

  // ============================================================================
  // STEP 3: Score company signals (0-35 points)
  // ============================================================================
  //
  // IMPROVED (2026-01-20): Better detection of scale indicators and platform mentions.
  // Previous logic undervalued high-volume merchants like "tens of millions of customers".
  //
  // Signal categories:
  // - SCALE INDICATORS: +15 pts (millions of customers, revenue mentions, etc.)
  // - PLATFORM SIGNALS: +12 pts (Shopify Plus, Amazon FBA, etc.)
  // - DTC/ECOMMERCE: +10 pts (direct-to-consumer, online store, etc.)
  // - INDUSTRY BONUS: +10 pts (Merchant in Retail/Consumer Goods industry)
  // - GENERAL COMMERCE: +5 pts (brand, retail, etc.)
  // ============================================================================
  let signalScore = 0;

  // ---------------------------------------------------------------------------
  // SCALE INDICATORS - High value, indicates significant business volume
  // ---------------------------------------------------------------------------
  const scaleIndicators = [
    'millions of customers', 'million customers', 'tens of millions',
    'hundreds of thousands', 'million units', 'millions sold',
    '$1m', '$2m', '$5m', '$10m', '$20m', '$50m', '$100m',
    '1 million', '2 million', '5 million', '10 million',
    'million in revenue', 'million revenue',
    '7-figure', '8-figure', '9-figure', 'seven figure', 'eight figure', 'nine figure',
    'seven-figure', 'eight-figure', 'nine-figure',
    'bestseller', 'best seller', 'best-seller', 'top seller', 'top-seller',
    '#1 seller', 'number one', '#1 brand',
    'inc 5000', 'inc. 5000', 'inc5000', 'fastest growing',
    'fortune 500', 'fortune 1000'
  ];

  if (scaleIndicators.some(indicator => combinedText.includes(indicator))) {
    signalScore += 15;
  }

  // ---------------------------------------------------------------------------
  // PLATFORM SIGNALS - High value, indicates specific e-commerce platform usage
  // ---------------------------------------------------------------------------
  // Shopify Plus is highest tier
  if (combinedText.includes('shopify plus')) {
    signalScore += 12;
  } else if (combinedText.includes('shopify')) {
    signalScore += 10;
  }

  // Amazon signals
  if (combinedText.includes('amazon seller') || combinedText.includes('amazon fba') ||
      combinedText.includes('selling on amazon') || combinedText.includes('amazon brand') ||
      combinedText.includes('amazon store')) {
    signalScore += 10;
  }

  // Other platforms
  if (combinedText.includes('bigcommerce')) signalScore += 8;
  if (combinedText.includes('woocommerce')) signalScore += 6;
  if (combinedText.includes('magento')) signalScore += 6;

  // ---------------------------------------------------------------------------
  // DTC / E-COMMERCE SIGNALS - Medium value
  // ---------------------------------------------------------------------------
  if (combinedText.includes('dtc') || combinedText.includes('d2c') ||
      combinedText.includes('direct-to-consumer') || combinedText.includes('direct to consumer')) {
    signalScore += 10;
  }

  if (combinedText.includes('e-commerce') || combinedText.includes('ecommerce') ||
      combinedText.includes('e commerce')) {
    signalScore += 8;
  }

  if (combinedText.includes('online store') || combinedText.includes('online brand') ||
      combinedText.includes('online shop')) {
    signalScore += 6;
  }

  // ---------------------------------------------------------------------------
  // FULFILLMENT / LOGISTICS SIGNALS - Medium value for merchants
  // ---------------------------------------------------------------------------
  if (breakdown.segment === 'merchant') {
    if (combinedText.includes('shipping') || combinedText.includes('fulfillment') ||
        combinedText.includes('warehouse') || combinedText.includes('logistics') ||
        combinedText.includes('3pl') || combinedText.includes('supply chain')) {
      signalScore += 8;
    }
  }

  // ---------------------------------------------------------------------------
  // INDUSTRY BONUS - For merchants in high-value retail industries
  // ---------------------------------------------------------------------------
  const highValueMerchantIndustries = [
    'retail', 'consumer goods', 'apparel', 'fashion', 'food & beverages',
    'food and beverages', 'health', 'wellness', 'fitness', 'sporting goods',
    'jewelry', 'cosmetics', 'beauty', 'home goods', 'furniture', 'electronics'
  ];

  if (breakdown.segment === 'merchant' &&
      highValueMerchantIndustries.some(ind => industry.includes(ind))) {
    signalScore += 10;
  }

  // ---------------------------------------------------------------------------
  // AGENCY-SPECIFIC SIGNALS
  // ---------------------------------------------------------------------------
  if (breakdown.segment === 'agency') {
    if (combinedText.includes('shopify partner') || combinedText.includes('shopify plus partner')) {
      signalScore += 12;
    }
    if (combinedText.includes('clients') && combinedText.includes('brands')) {
      signalScore += 5;
    }
  }

  // ---------------------------------------------------------------------------
  // GENERAL COMMERCE SIGNALS - Low value, common terms
  // ---------------------------------------------------------------------------
  if (combinedText.includes('brand') || combinedText.includes('products') ||
      combinedText.includes('customers served') || combinedText.includes('customer base')) {
    signalScore += 5;
  }

  if (combinedText.includes('physical products') || combinedText.includes('consumer brand') ||
      combinedText.includes('retail brand')) {
    signalScore += 5;
  }

  breakdown.companySignals = Math.min(signalScore, 35);

  // ============================================================================
  // STEP 4: Score company size (-10 to +15 points)
  // Reduced penalties since size data is often missing/unreliable
  // ============================================================================
  const companySize = parseCompanySize(prospect.companySize);

  if (companySize !== null) {
    if (breakdown.segment === 'agency') {
      // Agency sweet spot: 10-100 employees
      if (companySize >= 10 && companySize <= 100) {
        breakdown.companySize = 15; // Perfect fit
      } else if (companySize > 100 && companySize <= 200) {
        breakdown.companySize = 10; // Still good
      } else if (companySize > 200 && companySize <= 500) {
        breakdown.companySize = 5; // Okay
      } else if (companySize > 500) {
        breakdown.companySize = -10; // Too big (reduced penalty)
      } else if (companySize < 10 && companySize >= 2) {
        breakdown.companySize = 5; // Small but okay
      } else if (companySize === 1) {
        breakdown.companySize = -5; // Solo freelancer (reduced penalty)
      }
    } else if (breakdown.segment === 'merchant') {
      // Merchant sweet spot: 10-200 employees
      if (companySize >= 10 && companySize <= 200) {
        breakdown.companySize = 15; // Perfect fit
      } else if (companySize > 200 && companySize <= 500) {
        breakdown.companySize = 10; // Still good
      } else if (companySize > 500) {
        breakdown.companySize = 5; // Large enterprise
      } else if (companySize < 10 && companySize >= 2) {
        breakdown.companySize = 5; // Small but growing
      } else if (companySize === 1) {
        breakdown.companySize = 0; // Very small, neutral
      }
    }
  } else {
    // No size data - give a small neutral bonus rather than 0
    // Most prospects in the ICP have some company presence
    // Freelancers don't get this bonus since they don't have a company
    if (breakdown.segment !== 'freelancer') {
      breakdown.companySize = 5;
    }
  }

  // ============================================================================
  // STEP 5: Product category boost (0-10 points) - Minor factor
  // ============================================================================
  if (PRODUCT_CATEGORIES.some(cat => combinedText.includes(cat))) {
    breakdown.productCategory = 10;
  }

  // ============================================================================
  // STEP 6: Profile completeness (0-5 points)
  // ============================================================================
  if (prospect.aboutSummary && prospect.aboutSummary.length > 100) {
    breakdown.profileCompleteness = 5;
  }

  // ============================================================================
  // FINAL SCORE
  // ============================================================================
  const rawTotal = breakdown.titleAuthority + breakdown.companySignals +
                   breakdown.companySize + breakdown.productCategory +
                   breakdown.profileCompleteness;

  // Clamp to 0-100
  breakdown.total = Math.max(0, Math.min(100, rawTotal));

  return breakdown;
}

export function calculateICPScore(prospect: Partial<Prospect>): number {
  return calculateICPScoreWithBreakdown(prospect).total;
}

export function parseWorkingTab(data: RawWorkingRow[]): Map<string, Partial<PipelineRecord>> {
  const pipelineMap = new Map<string, Partial<PipelineRecord>>();

  for (const row of data) {
    const linkedinUrl = normalizeLinkedInUrl(row['LinkedIn URL']);
    if (!linkedinUrl) continue;

    const status = mapExcelStatus(row);

    pipelineMap.set(linkedinUrl, {
      status: status,
      visitedAt: row['Date Visited'] ? new Date(row['Date Visited']).toISOString() : undefined,
      connectionSentAt: row['Date'] ? new Date(row['Date']).toISOString() : undefined,
      connectionAcceptedAt: row['Connection Accepted'] ? new Date().toISOString() : undefined,
      messageSentAt: row['Message Sent'] ? new Date().toISOString() : undefined,
      notes: row['Notes / Personalization'] || undefined
    });
  }

  return pipelineMap;
}

function mapExcelStatus(row: RawWorkingRow): PipelineRecord['status'] {
  if (row['Message Sent']) return 'message_sent';
  if (row['Connection Accepted']) return 'connected';
  if (row['Connection Request']) return 'connection_sent';
  if (row['Visited']) return 'visited';
  return 'not_contacted';
}

export function parseScrapedTab(data: RawScrapedRow[]): Map<string, Partial<Prospect>> {
  const prospectMap = new Map<string, Partial<Prospect>>();

  for (const row of data) {
    const linkedinUrl = normalizeLinkedInUrl(row.linkedinUrl || '');
    if (!linkedinUrl) continue;

    const careerHistory = extractCareerHistory(row);

    const prospect: Partial<Prospect> = {
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      fullName: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      linkedinUrl: linkedinUrl,
      profilePicUrl: row.profilePicHighQuality || row.profilePic || undefined,
      headline: row.headline || '',
      aboutSummary: row.about || '',
      companyName: row.companyName || '',
      companyIndustry: row.companyIndustry || '',
      companySize: row.companySize || '',
      jobTitle: row.jobTitle || '',
      location: row.addressWithCountry || '',
      careerHistory: careerHistory,
      totalExperienceYears: row.totalExperienceYears || 0,
      topSkills: row.topSkillsByEndorsements || '',
      recentPosts: [], // Will be populated separately
    };

    const icpBreakdown = calculateICPScoreWithBreakdown(prospect);
    prospect.icpScore = icpBreakdown.total;
    prospect.icpScoreBreakdown = icpBreakdown;

    prospectMap.set(linkedinUrl, prospect);
  }

  return prospectMap;
}

function extractCareerHistory(row: RawScrapedRow): Experience[] {
  const history: Experience[] = [];

  for (let i = 0; i < 3; i++) {
    const companyKey = `experiences/${i}/companyName` as keyof RawScrapedRow;
    const titleKey = `experiences/${i}/title` as keyof RawScrapedRow;
    const descKey = `experiences/${i}/jobDescription` as keyof RawScrapedRow;

    const companyName = row[companyKey] as string | undefined;
    const title = row[titleKey] as string | undefined;
    const description = row[descKey] as string | undefined;

    if (companyName || title) {
      history.push({
        companyName: companyName || '',
        title: title || '',
        description: description || '',
        isCurrent: i === 0
      });
    }
  }

  return history;
}

function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';

  // Remove trailing slashes and normalize
  let normalized = url.toLowerCase().trim();

  // Ensure it starts with http
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }

  // Convert http to https
  normalized = normalized.replace('http://', 'https://');

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  // Ensure www is present for consistency
  if (normalized.includes('linkedin.com') && !normalized.includes('www.linkedin.com')) {
    normalized = normalized.replace('linkedin.com', 'www.linkedin.com');
  }

  return normalized;
}

export async function parseExcelFile(file: File): Promise<{
  prospects: Partial<Prospect>[];
  pipelineData: Map<string, Partial<PipelineRecord>>;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Parse WORKING tab for pipeline status
        const workingSheet = workbook.Sheets['WORKING'];
        const workingData = workingSheet
          ? XLSX.utils.sheet_to_json<RawWorkingRow>(workingSheet)
          : [];
        const pipelineData = parseWorkingTab(workingData);

        // Parse Scraped tab for full prospect data
        const scrapedSheet = workbook.Sheets['Scraped'];
        const scrapedData = scrapedSheet
          ? XLSX.utils.sheet_to_json<RawScrapedRow>(scrapedSheet)
          : [];
        const scrapedProspects = parseScrapedTab(scrapedData);

        // If no Scraped tab, use Prospects tab
        if (scrapedProspects.size === 0) {
          const prospectsSheet = workbook.Sheets['Prospects'];
          if (prospectsSheet) {
            const prospectsData = XLSX.utils.sheet_to_json<RawWorkingRow>(prospectsSheet);
            for (const row of prospectsData) {
              const linkedinUrl = normalizeLinkedInUrl(row['LinkedIn URL']);
              if (!linkedinUrl) continue;

              const prospect: Partial<Prospect> = {
                firstName: row['First Name'] || '',
                lastName: row['Last Name'] || '',
                fullName: `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim(),
                linkedinUrl: linkedinUrl,
                companyName: row['Company'] || '',
                jobTitle: row['Title'] || '',
                aboutSummary: row['About Summary'] || '',
                careerHistory: [],
                recentPosts: [],
                icpScore: 0
              };
              prospect.icpScore = calculateICPScore(prospect);
              scrapedProspects.set(linkedinUrl, prospect);
            }
          }
        }

        // Merge WORKING tab data into prospects for about summary
        for (const [url, pipeline] of pipelineData.entries()) {
          const prospect = scrapedProspects.get(url);
          if (prospect && pipeline.notes) {
            // Use notes as additional context
            prospect.aboutSummary = prospect.aboutSummary || pipeline.notes;
          }
        }

        resolve({
          prospects: Array.from(scrapedProspects.values()),
          pipelineData: pipelineData
        });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// For server-side parsing with file path
export function parseExcelFromBuffer(buffer: Buffer): {
  prospects: Partial<Prospect>[];
  pipelineData: Map<string, Partial<PipelineRecord>>;
} {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Parse WORKING tab
  const workingSheet = workbook.Sheets['WORKING'];
  const workingData = workingSheet
    ? XLSX.utils.sheet_to_json<RawWorkingRow>(workingSheet)
    : [];
  const pipelineData = parseWorkingTab(workingData);

  // Parse Scraped tab
  const scrapedSheet = workbook.Sheets['Scraped'];
  const scrapedData = scrapedSheet
    ? XLSX.utils.sheet_to_json<RawScrapedRow>(scrapedSheet)
    : [];
  const scrapedProspects = parseScrapedTab(scrapedData);

  return {
    prospects: Array.from(scrapedProspects.values()),
    pipelineData: pipelineData
  };
}

// ============================================================================
// TEST FUNCTION: Validate Title Authority Scoring
// ============================================================================
// Run this function to verify that title matching works correctly.
// Call testTitleScoring() from browser console or use in a test file.
// ============================================================================

interface TitleTestCase {
  title: string;
  expectedScore: number;
  segment?: 'merchant' | 'agency';
}

export function testTitleScoring(): void {
  const testCases: TitleTestCase[] = [
    // CEO variations - should all be +40
    { title: 'Chief Executive Officer', expectedScore: 40 },
    { title: 'CEO', expectedScore: 40 },
    { title: 'ceo', expectedScore: 40 },
    { title: 'CEO & Founder', expectedScore: 40 },
    { title: 'Co-Founder & CEO', expectedScore: 40 },
    { title: 'CEO/Founder', expectedScore: 40 },
    { title: 'President & CEO', expectedScore: 40 },
    { title: 'Chief Executive Officer at TRUEWERK', expectedScore: 40 },
    { title: 'Chief Executive Officer at Marquee Brands', expectedScore: 40 },

    // Founder variations - should all be +40
    { title: 'Founder', expectedScore: 40 },
    { title: 'Co-Founder', expectedScore: 40 },
    { title: 'Co-founder', expectedScore: 40 },
    { title: 'Cofounder', expectedScore: 40 },
    { title: 'Founder & CEO', expectedScore: 40 },

    // COO variations - should all be +40
    { title: 'COO', expectedScore: 40 },
    { title: 'Chief Operating Officer', expectedScore: 40 },
    { title: 'COO & Co-Founder', expectedScore: 40 },

    // Operations leadership for Merchants - should be +40
    { title: 'VP of Operations', expectedScore: 40 },
    { title: 'VP Operations', expectedScore: 40 },
    { title: 'Vice President of Operations', expectedScore: 40 },
    { title: 'Head of Operations', expectedScore: 40 },
    { title: 'Director of Operations', expectedScore: 40 },

    // E-commerce leadership for Merchants - should be +40
    { title: 'Head of E-commerce', expectedScore: 40 },
    { title: 'Head of Ecommerce', expectedScore: 40 },
    { title: 'VP of E-commerce', expectedScore: 40 },
    { title: 'Director of E-commerce', expectedScore: 40 },

    // Other top titles - should be +40
    { title: 'Owner', expectedScore: 40 },
    { title: 'President', expectedScore: 40 },
    { title: 'Managing Partner', expectedScore: 40 },

    // Secondary titles - should be +30
    { title: 'Operations Manager', expectedScore: 30 },
    { title: 'Head of Fulfillment', expectedScore: 30 },
    { title: 'Supply Chain Director', expectedScore: 30 },
    { title: 'E-commerce Manager', expectedScore: 30 },
    { title: 'Partner', expectedScore: 30 },
    { title: 'Principal', expectedScore: 30 },

    // Tertiary titles - should be +20
    { title: 'Director of Marketing', expectedScore: 20 },
    { title: 'Head of Sales', expectedScore: 20 },
    { title: 'VP of Sales', expectedScore: 20 },

    // Lower authority - should be +10
    { title: 'Marketing Manager', expectedScore: 10 },
    { title: 'Sales Lead', expectedScore: 10 },
    { title: 'Senior Developer', expectedScore: 10 },

    // No match - should be 0
    { title: 'Software Engineer', expectedScore: 0 },
    { title: 'Analyst', expectedScore: 0 },
  ];

  console.log('========================================');
  console.log('TITLE AUTHORITY SCORING TEST RESULTS');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    // Create a minimal prospect with just the title
    const prospect: Partial<Prospect> = {
      jobTitle: testCase.title,
      headline: '',
      companyName: testCase.segment === 'agency' ? 'Test Agency' : 'Test Company',
      aboutSummary: testCase.segment === 'agency'
        ? 'We are a Shopify agency helping clients'
        : 'DTC brand selling products on Shopify',
      companyIndustry: '',
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const actualScore = breakdown.titleAuthority;
    const status = actualScore === testCase.expectedScore ? '✓ PASS' : '✗ FAIL';

    if (actualScore === testCase.expectedScore) {
      passed++;
    } else {
      failed++;
    }

    console.log(`${status} | "${testCase.title}"`);
    console.log(`       Expected: ${testCase.expectedScore} pts | Actual: ${actualScore} pts`);
    if (actualScore !== testCase.expectedScore) {
      console.log(`       Segment detected: ${breakdown.segment}`);
    }
    console.log('');
  }

  console.log('========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  // Also test the specific bug cases mentioned
  console.log('\n========================================');
  console.log('BUG FIX VERIFICATION');
  console.log('========================================');

  const bugCases = [
    { name: 'Glenn Silbert', title: 'Chief Executive Officer', company: 'TRUEWERK' },
    { name: 'Heath Golden', title: 'Chief Executive Officer', company: 'Marquee Brands' },
  ];

  for (const bugCase of bugCases) {
    const prospect: Partial<Prospect> = {
      fullName: bugCase.name,
      jobTitle: bugCase.title,
      companyName: bugCase.company,
      aboutSummary: 'DTC brand selling products on Shopify',
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    console.log(`\n${bugCase.name} - ${bugCase.title} at ${bugCase.company}`);
    console.log(`  Title Authority: ${breakdown.titleAuthority} pts (expected: 40)`);
    console.log(`  Segment: ${breakdown.segment}`);
    console.log(`  Total ICP Score: ${breakdown.total}`);
    console.log(`  Status: ${breakdown.titleAuthority === 40 ? '✓ FIXED' : '✗ STILL BROKEN'}`);
  }
}
