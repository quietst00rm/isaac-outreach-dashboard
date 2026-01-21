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

// POST - Add watched profile(s) - supports single or bulk
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prospectId, linkedinUrl, linkedinUrls } = body as {
      prospectId?: string;
      linkedinUrl?: string;
      linkedinUrls?: string[];
    };

    // Bulk import
    if (linkedinUrls && Array.isArray(linkedinUrls) && linkedinUrls.length > 0) {
      const results = [];
      const errors = [];

      for (const url of linkedinUrls) {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) continue;

        try {
          const result = await addWatchedProfileByUrl(trimmedUrl);
          results.push(transformWatchedProfile(result as Record<string, unknown>));
        } catch (err) {
          errors.push({ url: trimmedUrl, error: String(err) });
        }
      }

      return NextResponse.json({
        success: true,
        added: results.length,
        failed: errors.length,
        profiles: results,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // Single add
    let result;

    if (prospectId) {
      result = await addWatchedProfile(prospectId);
    } else if (linkedinUrl) {
      result = await addWatchedProfileByUrl(linkedinUrl);
    } else {
      return NextResponse.json(
        { error: 'Either prospectId, linkedinUrl, or linkedinUrls is required' },
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
