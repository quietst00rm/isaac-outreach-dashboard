import { NextResponse } from 'next/server';
import { clearArchivedEngagementPosts } from '@/lib/supabase';

export async function DELETE() {
  try {
    await clearArchivedEngagementPosts();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing archived posts:', error);
    return NextResponse.json(
      { error: 'Failed to clear archived posts', details: String(error) },
      { status: 500 }
    );
  }
}
