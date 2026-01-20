import OpenAI from 'openai';
import { buildMessagePrompt } from './voice-profile';
import type { Prospect, MessageType } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

function buildProspectContext(prospect: Partial<Prospect>): string {
  const parts: string[] = [];

  parts.push(`Name: ${prospect.fullName || 'Unknown'}`);

  if (prospect.headline) {
    parts.push(`Headline: ${prospect.headline}`);
  }

  if (prospect.jobTitle && prospect.companyName) {
    parts.push(`Current Role: ${prospect.jobTitle} at ${prospect.companyName}`);
  } else if (prospect.companyName) {
    parts.push(`Company: ${prospect.companyName}`);
  }

  if (prospect.companyIndustry) {
    parts.push(`Industry: ${prospect.companyIndustry}`);
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

export async function generateMessage(
  prospect: Partial<Prospect>,
  messageType: MessageType
): Promise<string> {
  const prospectContext = buildProspectContext(prospect);
  const prompt = buildMessagePrompt(messageType, prospectContext);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (content) {
    return content.trim();
  }

  throw new Error('Unexpected response format from OpenAI');
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

  const prompt = `${buildMessagePrompt('comment', prospectContext)}

## Post to Comment On
${postContent}

Generate the comment now:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (content) {
    return content.trim();
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
