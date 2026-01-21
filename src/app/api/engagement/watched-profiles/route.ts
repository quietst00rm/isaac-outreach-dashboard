import { NextResponse } from 'next/server';
import {
  getWatchedProfiles,
  addWatchedProfile,
  addWatchedProfileByUrl,
  transformWatchedProfile
} from '@/lib/supabase';

// GET - List all watched profiles
export async function GET() {
  try {
    const profiles = await getWatchedProfiles();
    const transformed = (profiles || []).map(p => transformWatchedProfile(p as Record<string, unknown>));
    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching watched profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watched profiles', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Add a watched profile
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prospectId, linkedinUrl } = body as { prospectId?: string; linkedinUrl?: string };

    let result;

    if (prospectId) {
      // Add by prospect ID
      result = await addWatchedProfile(prospectId);
    } else if (linkedinUrl) {
      // Add by LinkedIn URL (will find or create prospect)
      result = await addWatchedProfileByUrl(linkedinUrl);
    } else {
      return NextResponse.json(
        { error: 'Either prospectId or linkedinUrl is required' },
        { status: 400 }
      );
    }

    const transformed = transformWatchedProfile(result as Record<string, unknown>);
    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error adding watched profile:', error);
    return NextResponse.json(
      { error: 'Failed to add watched profile', details: String(error) },
      { status: 500 }
    );
  }
}
