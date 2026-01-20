import { NextRequest, NextResponse } from 'next/server';
import { generateAllMessages } from '@/lib/claude';
import type { Prospect } from '@/types';

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

    const messages = await generateAllMessages(prospect);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error generating messages:', error);
    return NextResponse.json(
      { error: 'Failed to generate messages' },
      { status: 500 }
    );
  }
}
