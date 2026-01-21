import { NextResponse } from 'next/server';
import { getEngagementPosts, transformEngagementPost } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'active' | 'archived' | null;

    // Note: Auto-archiving only happens when fetching new posts from Apify
    // Not on every GET request, otherwise restored posts would be re-archived

    const posts = await getEngagementPosts(status || undefined);
    const transformed = (posts || []).map(p => transformEngagementPost(p as Record<string, unknown>));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching engagement posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: String(error) },
      { status: 500 }
    );
  }
}
