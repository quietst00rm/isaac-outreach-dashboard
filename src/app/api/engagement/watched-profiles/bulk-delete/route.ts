import { NextResponse } from 'next/server';
import { bulkRemoveWatchedProfilesByNames } from '@/lib/supabase';

// POST - Bulk remove watched profiles by names
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { names } = body as { names?: string[] };

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { error: 'names array is required' },
        { status: 400 }
      );
    }

    // Clean up names (trim whitespace)
    const cleanedNames = names.map(n => n.trim()).filter(n => n.length > 0);

    const result = await bulkRemoveWatchedProfilesByNames(cleanedNames);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error bulk removing watched profiles:', error);
    return NextResponse.json(
      { error: 'Failed to bulk remove watched profiles', details: String(error) },
      { status: 500 }
    );
  }
}
