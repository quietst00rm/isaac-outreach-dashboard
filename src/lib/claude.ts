import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import type { Prospect, MessageType } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Track types based on the skill file
export type MessageTrack =
  | 'OPERATOR_EXIT'
  | 'OPERATOR_SCALE'
  | 'OPERATOR_DTC'
  | 'AGENCY_PARTNER'
  | 'GENERIC_MERCHANT'
  | 'INFLUENCER_OUTREACH'
  | 'CONSULTANT_OUTREACH';

// Influencer signals for freelancer qualification
const INFLUENCER_SIGNALS = [
  'podcast', 'newsletter', 'followers', 'subscribers',
  'content creator', 'speaker', 'author', 'youtube',
  'influencer', 'creator economy', 'audience'
];

// Consultant signals for freelancer qualification
const CONSULTANT_SIGNALS = [
  'consultant', 'advisor', 'works with brands', 'shopify expert',
  'e-commerce consultant', 'ecommerce consultant', 'consulting',
  'advisory', 'fractional', 'works with merchants', 'brand strategist'
];

export interface MessageGenerationResult {
  track: MessageTrack;
  personalization_hook: string;
  messages: {
    connection_request: string;
    opening_dm: string;
    follow_up: string;
  };
}

export interface SkippedResult {
  skipped: true;
  skip_reason: string;
}

export type GenerationResult = MessageGenerationResult | SkippedResult;

/**
 * Check if a freelancer has influencer or consultant signals
 */
function hasFreelancerSignals(prospect: Partial<Prospect>): { hasSignals: boolean; type?: 'influencer' | 'consultant' } {
  const textToSearch = [
    prospect.headline || '',
    prospect.aboutSummary || ''
  ].join(' ').toLowerCase();

  // Check for influencer signals
  for (const signal of INFLUENCER_SIGNALS) {
    if (textToSearch.includes(signal)) {
      return { hasSignals: true, type: 'influencer' };
    }
  }

  // Check for consultant signals
  for (const signal of CONSULTANT_SIGNALS) {
    if (textToSearch.includes(signal)) {
      return { hasSignals: true, type: 'consultant' };
    }
  }

  return { hasSignals: false };
}

/**
 * Validate if a prospect qualifies for message generation
 */
export function validateProspectForGeneration(prospect: Partial<Prospect>): { valid: boolean; reason?: string; freelancerType?: 'influencer' | 'consultant' } {
  // Check required fields
  if (!prospect.fullName) {
    return { valid: false, reason: 'Missing full_name - required for personalization' };
  }

  if (!prospect.companyName) {
    return { valid: false, reason: 'Missing company_name - required for quality outreach' };
  }

  const segment = prospect.icpScoreBreakdown?.segment || 'unknown';
  const icpScore = prospect.icpScore ?? 0;

  // Merchants and agencies: require icp_score >= 50
  if (segment === 'merchant' || segment === 'agency') {
    if (icpScore < 50) {
      return { valid: false, reason: `ICP score ${icpScore} below threshold of 50 for ${segment}` };
    }
    return { valid: true };
  }

  // Freelancers: only include with influencer or consultant signals
  if (segment === 'freelancer') {
    const freelancerCheck = hasFreelancerSignals(prospect);
    if (!freelancerCheck.hasSignals) {
      return {
        valid: false,
        reason: 'Freelancer without influencer signals (podcast, newsletter, followers, subscribers, content creator, speaker, author) or consultant signals (consultant, advisor, works with brands, shopify expert, e-commerce consultant)'
      };
    }
    return { valid: true, freelancerType: freelancerCheck.type };
  }

  // Unknown segment - skip
  return { valid: false, reason: `Unknown segment: ${segment}` };
}

/**
 * Classify prospect into a track based on their data
 */
function classifyProspectTrack(prospect: Partial<Prospect>, freelancerType?: 'influencer' | 'consultant'): MessageTrack {
  const segment = prospect.icpScoreBreakdown?.segment || 'unknown';
  const aboutSummary = (prospect.aboutSummary || '').toLowerCase();
  const companySize = (prospect.companySize || '').toLowerCase();
  const companyIndustry = (prospect.companyIndustry || '').toLowerCase();

  // Freelancer tracks
  if (segment === 'freelancer') {
    if (freelancerType === 'influencer') {
      return 'INFLUENCER_OUTREACH';
    }
    return 'CONSULTANT_OUTREACH';
  }

  // Agency track
  if (segment === 'agency') {
    return 'AGENCY_PARTNER';
  }

  // Merchant tracks - check in priority order
  if (segment === 'merchant') {
    // OPERATOR_EXIT: Check for exit/acquisition experience
    const exitPatterns = ['sold', 'exit', 'acquired', 'acquisition', 'founded and sold', 'built and sold', 'exited'];
    for (const pattern of exitPatterns) {
      if (aboutSummary.includes(pattern)) {
        return 'OPERATOR_EXIT';
      }
    }

    // OPERATOR_SCALE: Check for scale indicators
    const scalePatterns = ['scaling', 'growth', 'grew', 'million', '$m', 'revenue'];
    const scaleSizes = ['51-200', '201-500', '501-1000'];

    for (const size of scaleSizes) {
      if (companySize.includes(size)) {
        return 'OPERATOR_SCALE';
      }
    }
    for (const pattern of scalePatterns) {
      if (aboutSummary.includes(pattern)) {
        return 'OPERATOR_SCALE';
      }
    }

    // OPERATOR_DTC: Check for DTC industry
    const dtcIndustries = ['apparel', 'fashion', 'consumer', 'retail', 'beauty', 'food', 'beverage', 'wellness'];
    for (const industry of dtcIndustries) {
      if (companyIndustry.includes(industry)) {
        return 'OPERATOR_DTC';
      }
    }

    // Default to generic merchant
    return 'GENERIC_MERCHANT';
  }

  return 'GENERIC_MERCHANT';
}

/**
 * Extract personalization hook from prospect data
 */
function extractPersonalizationHook(prospect: Partial<Prospect>): string {
  const aboutSummary = prospect.aboutSummary || '';
  const headline = prospect.headline || '';
  const companyIndustry = prospect.companyIndustry || '';

  // Priority 1: Specific achievement with numbers
  const achievementPatterns = [
    /\$[\d.]+\s*(million|m|billion|b|k)/i,
    /(\d+)\+?\s*years/i,
    /grew\s+(from\s+)?[\w\s]+to\s+[\w\s$\d]+/i,
    /#1\s+[\w\s]+/i,
    /largest\s+[\w\s]+/i
  ];

  for (const pattern of achievementPatterns) {
    const match = aboutSummary.match(pattern);
    if (match) {
      // Extract surrounding context
      const index = aboutSummary.indexOf(match[0]);
      const start = Math.max(0, index - 30);
      const end = Math.min(aboutSummary.length, index + match[0].length + 30);
      let context = aboutSummary.slice(start, end).trim();
      // Clean up to sentence boundaries if possible
      if (start > 0) context = '...' + context;
      if (end < aboutSummary.length) context = context + '...';
      return context;
    }
  }

  // Priority 2: Exit/acquisition reference
  const exitPatterns = ['sold to', 'acquired by', 'exited', 'founded and sold', 'built and sold'];
  for (const pattern of exitPatterns) {
    if (aboutSummary.toLowerCase().includes(pattern)) {
      const index = aboutSummary.toLowerCase().indexOf(pattern);
      const start = Math.max(0, index - 20);
      const end = Math.min(aboutSummary.length, index + pattern.length + 40);
      let context = aboutSummary.slice(start, end).trim();
      if (start > 0) context = '...' + context;
      if (end < aboutSummary.length) context = context + '...';
      return context;
    }
  }

  // Priority 3: Role context
  const rolePatterns = ['i lead', 'i run', 'responsible for', 'overseeing', 'head of', 'leading'];
  for (const pattern of rolePatterns) {
    if (aboutSummary.toLowerCase().includes(pattern)) {
      const index = aboutSummary.toLowerCase().indexOf(pattern);
      const end = Math.min(aboutSummary.length, index + 60);
      let context = aboutSummary.slice(index, end).trim();
      if (end < aboutSummary.length) context = context + '...';
      return context;
    }
  }

  // Priority 4: Company positioning
  const positionPatterns = ['premier', 'leading', 'fastest growing', 'largest', 'top'];
  for (const pattern of positionPatterns) {
    if (aboutSummary.toLowerCase().includes(pattern)) {
      const index = aboutSummary.toLowerCase().indexOf(pattern);
      const end = Math.min(aboutSummary.length, index + 50);
      let context = aboutSummary.slice(index, end).trim();
      if (end < aboutSummary.length) context = context + '...';
      return context;
    }
  }

  // Fallback: Use headline if about_summary is short
  if (aboutSummary.length < 50 && headline.length > 10) {
    return headline;
  }

  // Fallback: Use first meaningful part of about_summary
  if (aboutSummary.length > 0) {
    const truncated = aboutSummary.slice(0, 80).trim();
    return truncated.length < aboutSummary.length ? truncated + '...' : truncated;
  }

  // Last resort: Generic based on industry
  if (companyIndustry) {
    return `your work in the ${companyIndustry} space`;
  }

  return `your work at ${prospect.companyName || 'your company'}`;
}

/**
 * Load the skill file for system prompt
 */
function loadSkillFile(): string {
  try {
    const skillPath = path.join(process.cwd(), 'src', 'prompts', 'isaac-linkedin-outreach.md');
    return fs.readFileSync(skillPath, 'utf-8');
  } catch (error) {
    console.error('Error loading skill file:', error);
    // Return a minimal fallback
    return 'Generate personalized LinkedIn outreach messages following Isaac Stern\'s voice.';
  }
}

function buildProspectContext(prospect: Partial<Prospect>): string {
  const parts: string[] = [];

  // Basic info
  const firstName = prospect.firstName || prospect.fullName?.split(' ')[0] || 'Unknown';
  parts.push(`First Name: ${firstName}`);
  parts.push(`Full Name: ${prospect.fullName || 'Unknown'}`);

  // ICP Score
  if (prospect.icpScore !== undefined) {
    parts.push(`ICP Score: ${prospect.icpScore}`);
  }

  // Segment (critical for message framing)
  if (prospect.icpScoreBreakdown?.segment) {
    parts.push(`Segment: ${prospect.icpScoreBreakdown.segment}`);
  }

  if (prospect.headline) {
    parts.push(`Headline: ${prospect.headline}`);
  }

  if (prospect.jobTitle && prospect.companyName) {
    parts.push(`Current Role: ${prospect.jobTitle} at ${prospect.companyName}`);
  } else if (prospect.companyName) {
    parts.push(`Company: ${prospect.companyName}`);
  } else if (prospect.jobTitle) {
    parts.push(`Job Title: ${prospect.jobTitle}`);
  }

  if (prospect.companyIndustry) {
    parts.push(`Industry: ${prospect.companyIndustry}`);
  }

  if (prospect.companySize) {
    parts.push(`Company Size: ${prospect.companySize}`);
  }

  if (prospect.aboutSummary) {
    const truncatedAbout = prospect.aboutSummary.length > 500
      ? prospect.aboutSummary.substring(0, 500) + '...'
      : prospect.aboutSummary;
    parts.push(`About: ${truncatedAbout}`);
  }

  if (prospect.careerHistory && prospect.careerHistory.length > 0) {
    parts.push('Career History:');
    for (const exp of prospect.careerHistory.slice(0, 3)) {
      let expLine = `- ${exp.title}`;
      if (exp.companyName) expLine += ` at ${exp.companyName}`;
      if (exp.isCurrent) expLine += ' (current)';
      parts.push(expLine);
    }
  }

  if (prospect.topSkills) {
    parts.push(`Top Skills: ${prospect.topSkills}`);
  }

  if (prospect.location) {
    parts.push(`Location: ${prospect.location}`);
  }

  return parts.join('\n');
}

/**
 * Generate all messages for a prospect using the skill file approach
 */
export async function generateMessagesWithSkill(
  prospect: Partial<Prospect>
): Promise<GenerationResult> {
  // Validate prospect first
  const validation = validateProspectForGeneration(prospect);
  if (!validation.valid) {
    return {
      skipped: true,
      skip_reason: validation.reason!
    };
  }

  // Classify into track
  const track = classifyProspectTrack(prospect, validation.freelancerType);

  // Extract personalization hook
  const personalization_hook = extractPersonalizationHook(prospect);

  // Load skill file as system prompt
  const skillPrompt = loadSkillFile();

  // Build prospect context
  const prospectContext = buildProspectContext(prospect);

  // Generate messages using OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: skillPrompt
      },
      {
        role: 'user',
        content: `Generate all three message types (connection_request, opening_dm, follow_up) for this prospect.

## Assigned Track: ${track}

## Personalization Hook
Use this specific detail in the messages: "${personalization_hook}"

## Prospect Data
${prospectContext}

## Output Format
Return ONLY a JSON object with this exact structure, no markdown code blocks:
{
  "connection_request": "the message text here",
  "opening_dm": "the message text here",
  "follow_up": "the message text here"
}

Remember:
- connection_request: Max 300 characters
- opening_dm: Max 800 characters
- follow_up: Max 400 characters
- NO em-dashes, NO exclamation points, NO emojis
- End statements with periods (opening_dm should not end with a question)
- All messages end with "Isaac" on its own line`
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Parse the JSON response
  let messages: { connection_request: string; opening_dm: string; follow_up: string };
  try {
    // Clean up potential markdown code blocks
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.slice(7);
    }
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.slice(0, -3);
    }
    messages = JSON.parse(cleanContent.trim());
  } catch (parseError) {
    console.error('Failed to parse OpenAI response as JSON:', content);
    throw new Error('Failed to parse message generation response');
  }

  return {
    track,
    personalization_hook,
    messages
  };
}

// ===== LEGACY FUNCTIONS (kept for backwards compatibility with comments feature) =====

// Import from deprecated voice-profile for comment generation
import { buildMessagePrompt, COMMENT_PROMPT } from './voice-profile';

// Banned phrases for comment validation
const COMMENT_BANNED_PHRASES = [
  'truscope golf', 'legacy seller', 'parcelis',
  'track it or lose it', 'game changer', 'get there or get left behind',
  'keeps it moving', 'track what\'s real',
  'this resonates deeply', 'evolving landscape',
  'efficiency', 'alignment', 'precision', 'protocols', 'friction',
  'optimization', 'strategic', 'leverage', 'synergy', 'scalable', 'robust'
];

function validateComment(comment: string, postContent: string): boolean {
  const lowerComment = comment.toLowerCase();
  const lowerPost = postContent.toLowerCase();

  // Check for banned phrases (allow company names only if post is about that topic)
  const postAboutGolf = lowerPost.includes('golf') || lowerPost.includes('pga');
  const postAboutAmazon = lowerPost.includes('amazon') || lowerPost.includes('reimbursement');
  const postAboutShipping = lowerPost.includes('shipping') || lowerPost.includes('protection');

  for (const banned of COMMENT_BANNED_PHRASES) {
    if (lowerComment.includes(banned)) {
      // Allow company names only if post is relevant
      if (banned === 'truscope golf' && postAboutGolf) continue;
      if (banned === 'legacy seller' && postAboutAmazon) continue;
      if (banned === 'parcelis' && postAboutShipping) continue;
      return false;
    }
  }

  return true;
}

export interface CommentOptions {
  conversational: string;  // Option 1 - with question
  perspective: string;     // Option 2 - no company names
  brief: string;           // Option 3 - brief and genuine
}

export async function generateComments(
  prospect: Partial<Prospect>,
  postContent: string
): Promise<CommentOptions> {
  const prospectContext = buildProspectContext(prospect);

  // Truncate post content to avoid overly long prompts
  const truncatedPost = postContent.length > 800
    ? postContent.substring(0, 800) + '...'
    : postContent;

  const prompt = `${buildMessagePrompt('comment', prospectContext)}

## Post to Comment On
${truncatedPost}

Generate 3 comment options now (separated by ---):`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content: `You generate LinkedIn comments that sound human. Follow these rules EXACTLY:
1. NO company name-dropping (Truscope Golf, Legacy Seller, Parcelis) unless the post is directly about that topic
2. NO fragment phrases like "Track it or lose it" - write natural sentences
3. Actually engage with the specific topic of the post
4. Option 1 MUST include a question
5. Keep each comment to 1-3 sentences max
Return 3 comments separated by ---`
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Parse the 3 options
  const parts = content.split('---').map(p => {
    let cleaned = p.trim();
    // Remove leading/trailing quotes
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    // Remove option labels if present
    cleaned = cleaned.replace(/^(Option \d[:\s-]*|Conversational[:\s-]*|Perspective[:\s-]*|Brief[:\s-]*)/i, '').trim();
    return cleaned;
  }).filter(p => p.length > 0);

  // Ensure we have 3 options
  while (parts.length < 3) {
    parts.push(parts[0] || 'Great post.');
  }

  // Validate and log warnings
  for (let i = 0; i < parts.length; i++) {
    if (!validateComment(parts[i], postContent)) {
      console.warn(`Comment option ${i + 1} contains banned content, may need review`);
    }
  }

  return {
    conversational: parts[0],
    perspective: parts[1],
    brief: parts[2]
  };
}

// Legacy single comment function (returns first option for backwards compatibility)
export async function generateComment(
  prospect: Partial<Prospect>,
  postContent: string
): Promise<string> {
  const options = await generateComments(prospect, postContent);
  return options.conversational;
}

// Legacy function - kept for backwards compatibility but now wraps new implementation
export async function generateAllMessages(
  prospect: Partial<Prospect>
): Promise<{
  connectionRequest: string;
  followUp1: string;
  followUp2: string;
}> {
  const result = await generateMessagesWithSkill(prospect);

  if ('skipped' in result) {
    // Return empty messages if skipped
    return {
      connectionRequest: '',
      followUp1: '',
      followUp2: ''
    };
  }

  return {
    connectionRequest: result.messages.connection_request,
    followUp1: result.messages.opening_dm,
    followUp2: result.messages.follow_up
  };
}

// Batch generate messages for multiple prospects
export async function batchGenerateMessages(
  prospects: Partial<Prospect>[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, { connectionRequest: string; followUp1: string; followUp2: string }>> {
  const results = new Map<string, { connectionRequest: string; followUp1: string; followUp2: string }>();

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  let completed = 0;

  for (let i = 0; i < prospects.length; i += batchSize) {
    const batch = prospects.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (prospect) => {
        try {
          const messages = await generateAllMessages(prospect);
          return { linkedinUrl: prospect.linkedinUrl!, messages };
        } catch (error) {
          console.error(`Error generating messages for ${prospect.fullName}:`, error);
          return {
            linkedinUrl: prospect.linkedinUrl!,
            messages: {
              connectionRequest: '',
              followUp1: '',
              followUp2: ''
            }
          };
        }
      })
    );

    for (const result of batchResults) {
      results.set(result.linkedinUrl, result.messages);
    }

    completed += batch.length;
    onProgress?.(completed, prospects.length);

    // Small delay between batches to respect rate limits
    if (i + batchSize < prospects.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
