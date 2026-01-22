import { NextRequest, NextResponse } from 'next/server';
import { generateMessagesWithSkill, type GenerationResult, type MessageTrack } from '@/lib/claude';
import type { Prospect } from '@/types';

export interface MessageGenerationResponse {
  track: MessageTrack;
  personalization_hook: string;
  messages: {
    connection_request: string;
    opening_dm: string;
    follow_up: string;
  };
}

export interface SkippedResponse {
  skipped: true;
  skip_reason: string;
}

export type GenerateMessagesResponse = MessageGenerationResponse | SkippedResponse;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospect } = body as { prospect: Partial<Prospect> };

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect data is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const result = await generateMessagesWithSkill(prospect);

    // Return the full result which includes either:
    // - { track, personalization_hook, messages } for successful generation
    // - { skipped: true, skip_reason } for skipped prospects
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating messages:', error);
    return NextResponse.json(
      { error: 'Failed to generate messages' },
      { status: 500 }
    );
  }
}
