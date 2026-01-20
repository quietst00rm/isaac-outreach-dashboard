import * as XLSX from 'xlsx';
import type {
  Prospect,
  PipelineRecord,
  Experience,
  RawWorkingRow,
  RawScrapedRow,
  ICPScoreBreakdown
} from '@/types';

// High-value industries for ICP scoring
const HIGH_VALUE_INDUSTRIES = [
  'e-commerce', 'retail', 'consumer goods', 'electronics',
  'jewelry', 'supplements', 'fashion', 'beauty', 'health',
  'home goods', 'sporting goods', 'pet supplies'
];

// High-value titles for ICP scoring
const HIGH_VALUE_TITLES = [
  'founder', 'ceo', 'owner', 'co-founder', 'president',
  'director', 'head of', 'vp', 'chief', 'partner'
];

// Agency indicators
const AGENCY_INDICATORS = [
  'agency', 'partner', 'consultant', 'shopify', 'e-commerce services',
  'marketing agency', 'digital agency'
];

export function calculateICPScoreWithBreakdown(prospect: Partial<Prospect>): ICPScoreBreakdown {
  const breakdown: ICPScoreBreakdown = {
    industry: 0,
    title: 0,
    agency: 0,
    ecommerceExperience: 0,
    profileCompleteness: 0,
    total: 0
  };

  // Industry scoring (0-30 points)
  const industry = (prospect.companyIndustry || '').toLowerCase();
  if (HIGH_VALUE_INDUSTRIES.some(i => industry.includes(i))) {
    breakdown.industry = 30;
  } else if (industry.includes('technology') || industry.includes('software')) {
    breakdown.industry = 15;
  }

  // Title scoring (0-25 points)
  const title = (prospect.jobTitle || prospect.headline || '').toLowerCase();
  if (HIGH_VALUE_TITLES.some(t => title.includes(t))) {
    breakdown.title = 25;
  } else if (title.includes('manager') || title.includes('lead')) {
    breakdown.title = 10;
  }

  // Agency detection (bonus 20 points)
  const companyName = (prospect.companyName || '').toLowerCase();
  const about = (prospect.aboutSummary || '').toLowerCase();
  if (AGENCY_INDICATORS.some(a => companyName.includes(a) || about.includes(a))) {
    breakdown.agency = 20;
  }

  // E-commerce experience (0-15 points)
  if (about.includes('shopify') || about.includes('e-commerce') ||
      about.includes('ecommerce') || about.includes('dtc') ||
      about.includes('amazon') || about.includes('direct-to-consumer')) {
    breakdown.ecommerceExperience = 15;
  }

  // Has about summary (profile completeness) (0-10 points)
  if (prospect.aboutSummary && prospect.aboutSummary.length > 100) {
    breakdown.profileCompleteness = 10;
  }

  breakdown.total = Math.min(
    breakdown.industry + breakdown.title + breakdown.agency +
    breakdown.ecommerceExperience + breakdown.profileCompleteness,
    100
  );

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
