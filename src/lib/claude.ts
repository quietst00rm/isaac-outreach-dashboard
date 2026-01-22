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

export async function generateComment(
  prospect: Partial<Prospect>,
  postContent: string
): Promise<string> {
  const prospectContext = buildProspectContext(prospect);

  // Truncate post content to avoid overly long prompts
  const truncatedPost = postContent.length > 800
    ? postContent.substring(0, 800) + '...'
    : postContent;

  const prompt = `${buildMessagePrompt('comment', prospectContext)}

## Post to Comment On
${truncatedPost}

Write a SHORT (15-25 words max) comment now:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 100,
    temperature: 0.9,
    messages: [
      {
        role: 'system',
        content: 'You are a comment generator. Write short, human-sounding comments. No buzzwords, no AI speak. Return ONLY the comment text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (content) {
    let cleaned = content.trim();
    // Remove leading/trailing quotes
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned.trim();
  }

  throw new Error('Unexpected response format from OpenAI');
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
