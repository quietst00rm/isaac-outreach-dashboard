import { NextResponse } from 'next/server';
import { getProspects, transformDbToApp } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await getProspects();
    const transformed = transformDbToApp(data || []);
    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prospects', details: String(error) },
      { status: 500 }
    );
  }
}
