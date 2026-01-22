import OpenAI from 'openai';
import { buildMessagePrompt } from './voice-profile';
import type { Prospect, MessageType } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Banned words/phrases for validation
const CONNECTION_REQUEST_BANNED = [
  'parcelis', 'shipping', 'protection', 'insurance', 'synerg', 'align',
  'overlap', 'collaborate', 'value', 'opportunity', 'isaac stern',
  'truscope', 'legacy seller', 'ace comply', "let's connect"
];

const FOLLOW_UP_1_BANNED = [
  'great to connect', 'thanks for connecting', 'pleasure to connect',
  'hidden money', 'profit leak', 'untapped revenue', 'protect your bottom line',
  'curious if', 'open to sharing', 'would love to explore'
];

const FOLLOW_UP_2_BANNED = [
  'hope this finds', 'touch base', 'following up', 'circling back',
  'circle back', 'revisit', 'previous conversation', 'our discussion',
  'if now isn\'t a good time', 'best,', 'best regards', 'thank you,', 'isaac'
];

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

function validateConnectionRequest(message: string): ValidationResult {
  // Allow blank requests
  if (message === '[BLANK]' || message === '' || message.trim() === '') {
    return { valid: true };
  }

  // Check length
  if (message.length > 180) {
    return { valid: false, reason: `Too long: ${message.length} chars (max 180)` };
  }

  // Check banned words
  const lowerMessage = message.toLowerCase();
  for (const banned of CONNECTION_REQUEST_BANNED) {
    if (lowerMessage.includes(banned)) {
      return { valid: false, reason: `Contains banned phrase: "${banned}"` };
    }
  }

  return { valid: true };
}

function validateFollowUp1(message: string): ValidationResult {
  // Check length
  if (message.length > 300) {
    return { valid: false, reason: `Too long: ${message.length} chars (max 300)` };
  }

  // Must end with question mark
  if (!message.trim().endsWith('?')) {
    return { valid: false, reason: 'Must end with a question mark' };
  }

  // Check banned phrases
  const lowerMessage = message.toLowerCase();
  for (const banned of FOLLOW_UP_1_BANNED) {
    if (lowerMessage.includes(banned)) {
      return { valid: false, reason: `Contains banned phrase: "${banned}"` };
    }
  }

  // Count sentences (rough check)
  const sentenceCount = (message.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 3) {
    return { valid: false, reason: `Too many sentences: ${sentenceCount} (max 3)` };
  }

  return { valid: true };
}

function validateFollowUp2(message: string): ValidationResult {
  // Check length
  if (message.length > 100) {
    return { valid: false, reason: `Too long: ${message.length} chars (max 100)` };
  }

  // Check banned phrases
  const lowerMessage = message.toLowerCase();
  for (const banned of FOLLOW_UP_2_BANNED) {
    if (lowerMessage.includes(banned)) {
      return { valid: false, reason: `Contains banned phrase: "${banned}"` };
    }
  }

  // Count sentences (rough check)
  const sentenceCount = (message.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 2) {
    return { valid: false, reason: `Too many sentences: ${sentenceCount} (max 2)` };
  }

  return { valid: true };
}

function validateMessage(message: string, messageType: MessageType): ValidationResult {
  switch (messageType) {
    case 'connection_request':
      return validateConnectionRequest(message);
    case 'follow_up_1':
      return validateFollowUp1(message);
    case 'follow_up_2':
      return validateFollowUp2(message);
    case 'comment':
      // Comments have looser validation
      return { valid: true };
    default:
      return { valid: true };
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

    // Flag notable patterns in about summary
    const aboutLower = prospect.aboutSummary.toLowerCase();
    if (aboutLower.includes('exit') || aboutLower.includes('sold') || aboutLower.includes('acquisition')) {
      parts.push(`[NOTE: Has exit/acquisition experience - can reference "fellow operator"]`);
    }
    if (aboutLower.includes('founder') || aboutLower.includes('co-founder')) {
      parts.push(`[NOTE: Founder - can reference entrepreneurial journey]`);
    }
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

export async function generateMessage(
  prospect: Partial<Prospect>,
  messageType: MessageType,
  maxRetries: number = 3
): Promise<string> {
  const prospectContext = buildProspectContext(prospect);
  const prompt = buildMessagePrompt(messageType, prospectContext);

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      temperature: attempt === 1 ? 0.7 : 0.9, // Increase temperature on retries for variety
      messages: [
        {
          role: 'system',
          content: 'You are a message generator for LinkedIn outreach. Follow the constraints EXACTLY. Return ONLY the message text, nothing else.'
        },
        {
          role: 'user',
          content: prompt + (lastError ? `\n\n[PREVIOUS ATTEMPT FAILED: ${lastError}. Try again following constraints more carefully.]` : '')
        }
      ]
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean up the response
    content = content.trim();

    // Remove surrounding quotes if present
    if ((content.startsWith('"') && content.endsWith('"')) ||
        (content.startsWith("'") && content.endsWith("'"))) {
      content = content.slice(1, -1).trim();
    }

    // Handle [BLANK] for connection requests
    if (messageType === 'connection_request' &&
        (content === '[BLANK]' || content.toLowerCase() === 'blank')) {
      return ''; // Return empty string for blank requests
    }

    // Validate the message
    const validation = validateMessage(content, messageType);

    if (validation.valid) {
      return content;
    }

    console.warn(`Attempt ${attempt}/${maxRetries} failed validation: ${validation.reason}`);
    lastError = validation.reason;

    // If this was the last attempt, return the message anyway but log warning
    if (attempt === maxRetries) {
      console.error(`Message failed validation after ${maxRetries} attempts. Returning anyway: ${validation.reason}`);
      return content;
    }
  }

  throw new Error('Failed to generate valid message');
}

export async function generateAllMessages(
  prospect: Partial<Prospect>
): Promise<{
  connectionRequest: string;
  followUp1: string;
  followUp2: string;
}> {
  // Generate all three message types in parallel
  const [connectionRequest, followUp1, followUp2] = await Promise.all([
    generateMessage(prospect, 'connection_request'),
    generateMessage(prospect, 'follow_up_1'),
    generateMessage(prospect, 'follow_up_2')
  ]);

  return {
    connectionRequest,
    followUp1,
    followUp2
  };
}

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
