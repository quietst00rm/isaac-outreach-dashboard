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

// Highest priority agency titles (decision-makers)
const AGENCY_TOP_TITLES = [
  'founder', 'ceo', 'co-founder', 'cofounder', 'owner',
  'managing partner', 'director of partnerships', 'partnerships director'
];

// Secondary priority agency titles
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
const MERCHANT_TOP_TITLES = [
  'founder', 'ceo', 'co-founder', 'cofounder', 'owner',
  'coo', 'vp of operations', 'head of operations', 'operations director',
  'director of operations', 'chief operating'
];

// Secondary merchant titles
const MERCHANT_SECONDARY_TITLES = [
  'vp operations', 'operations manager', 'head of fulfillment',
  'director of fulfillment', 'supply chain director', 'head of supply chain',
  'ecommerce manager', 'e-commerce manager', 'head of ecommerce'
];

// Product categories (minor boost only - often unreliable)
const PRODUCT_CATEGORIES = [
  'electronics', 'jewelry', 'supplements', 'vitamins', 'fashion',
  'apparel', 'beauty', 'cosmetics', 'skincare', 'health',
  'home goods', 'furniture', 'sporting goods', 'pet supplies',
  'ceramics', 'premium', 'luxury'
];

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
    segment: 'unknown',
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
  // STEP 1: Detect segment (Agency vs Merchant)
  // ============================================================================
  const isAgency = AGENCY_KEYWORDS.some(kw => combinedText.includes(kw)) &&
    (companyName.includes('agency') || companyName.includes('partner') ||
     companyName.includes('consulting') || companyName.includes('digital') ||
     about.includes('agency') || about.includes('clients'));

  const isMerchant = MERCHANT_KEYWORDS.some(kw => combinedText.includes(kw)) &&
    !isAgency; // Merchants are NOT agencies

  if (isAgency) {
    breakdown.segment = 'agency';
  } else if (isMerchant) {
    breakdown.segment = 'merchant';
  }

  // ============================================================================
  // STEP 2: Score title authority (0-35 points)
  // ============================================================================
  if (breakdown.segment === 'agency') {
    // Agency title scoring
    if (AGENCY_TOP_TITLES.some(t => title.includes(t))) {
      breakdown.titleAuthority = 35;
    } else if (AGENCY_SECONDARY_TITLES.some(t => title.includes(t))) {
      breakdown.titleAuthority = 25;
    } else if (title.includes('director') || title.includes('head of') || title.includes('vp')) {
      breakdown.titleAuthority = 15;
    } else if (title.includes('manager') || title.includes('lead')) {
      breakdown.titleAuthority = 5;
    }
  } else if (breakdown.segment === 'merchant') {
    // Merchant title scoring
    if (MERCHANT_TOP_TITLES.some(t => title.includes(t))) {
      breakdown.titleAuthority = 35;
    } else if (MERCHANT_SECONDARY_TITLES.some(t => title.includes(t))) {
      breakdown.titleAuthority = 25;
    } else if (title.includes('director') || title.includes('head of') || title.includes('vp')) {
      breakdown.titleAuthority = 15;
    } else if (title.includes('manager') || title.includes('lead')) {
      breakdown.titleAuthority = 5;
    }
  } else {
    // Unknown segment - still score decision-maker titles
    const allTopTitles = [...new Set([...AGENCY_TOP_TITLES, ...MERCHANT_TOP_TITLES])];
    if (allTopTitles.some(t => title.includes(t))) {
      breakdown.titleAuthority = 20; // Lower score for unknown segment
    } else if (title.includes('director') || title.includes('head of') || title.includes('vp')) {
      breakdown.titleAuthority = 10;
    }
  }

  // ============================================================================
  // STEP 3: Score company signals (0-30 points)
  // ============================================================================
  let signalScore = 0;

  // Shopify-related signals (highest value)
  if (combinedText.includes('shopify plus')) signalScore += 15;
  else if (combinedText.includes('shopify')) signalScore += 12;

  // E-commerce/DTC signals
  if (combinedText.includes('dtc') || combinedText.includes('d2c') ||
      combinedText.includes('direct-to-consumer') || combinedText.includes('direct to consumer')) {
    signalScore += 10;
  }

  // Other platform signals
  if (combinedText.includes('e-commerce') || combinedText.includes('ecommerce')) {
    signalScore += 8;
  }

  // Shipping/fulfillment signals (for merchants)
  if (breakdown.segment === 'merchant') {
    if (combinedText.includes('shipping') || combinedText.includes('fulfillment') ||
        combinedText.includes('logistics') || combinedText.includes('3pl')) {
      signalScore += 5;
    }
  }

  // Agency-specific signals
  if (breakdown.segment === 'agency') {
    if (combinedText.includes('shopify partner') || combinedText.includes('shopify plus partner')) {
      signalScore += 10;
    }
  }

  breakdown.companySignals = Math.min(signalScore, 30);

  // ============================================================================
  // STEP 4: Score company size (-15 to +20 points)
  // ============================================================================
  const companySize = parseCompanySize(prospect.companySize);

  if (companySize !== null) {
    if (breakdown.segment === 'agency') {
      // Agency sweet spot: 10-100 employees
      if (companySize >= 10 && companySize <= 100) {
        breakdown.companySize = 20; // Perfect fit
      } else if (companySize > 100 && companySize <= 200) {
        breakdown.companySize = 10; // Still good
      } else if (companySize > 200 && companySize <= 500) {
        breakdown.companySize = 0; // Neutral
      } else if (companySize > 500) {
        breakdown.companySize = -15; // Too big (large consultancy)
      } else if (companySize < 10 && companySize >= 2) {
        breakdown.companySize = 5; // Small but okay
      } else if (companySize === 1) {
        breakdown.companySize = -10; // Solo freelancer
      }
    } else if (breakdown.segment === 'merchant') {
      // Merchant sweet spot: 10-200 employees
      if (companySize >= 10 && companySize <= 200) {
        breakdown.companySize = 20; // Perfect fit
      } else if (companySize > 200 && companySize <= 500) {
        breakdown.companySize = 10; // Still good
      } else if (companySize > 500) {
        breakdown.companySize = 0; // Large enterprise, may have different needs
      } else if (companySize < 10 && companySize >= 2) {
        breakdown.companySize = 5; // Small but growing
      } else if (companySize === 1) {
        breakdown.companySize = -5; // Very small
      }
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
