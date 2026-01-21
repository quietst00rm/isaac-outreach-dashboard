import { NextResponse } from 'next/server';
import { archiveEngagementPost, restoreEngagementPost } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body as { action: 'archive' | 'restore'; reason?: 'aged' | 'engaged' };

    if (action === 'archive') {
      const post = await archiveEngagementPost(id, reason || 'engaged');
      return NextResponse.json(post);
    } else if (action === 'restore') {
      const post = await restoreEngagementPost(id);
      return NextResponse.json(post);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "archive" or "restore"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating engagement post:', error);
    return NextResponse.json(
      { error: 'Failed to update post', details: String(error) },
      { status: 500 }
    );
  }
}
