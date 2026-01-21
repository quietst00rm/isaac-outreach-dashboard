import { NextResponse } from 'next/server';
import { removeWatchedProfile } from '@/lib/supabase';

// DELETE - Remove a watched profile
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await removeWatchedProfile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing watched profile:', error);
    return NextResponse.json(
      { error: 'Failed to remove watched profile', details: String(error) },
      { status: 500 }
    );
  }
}
