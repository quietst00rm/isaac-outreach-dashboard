import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const { ids, status } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No prospect IDs provided' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'No status provided' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create upsert records for each prospect
    const pipelineRecords = ids.map((id: string) => ({
      prospect_id: id,
      status: status,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('pipeline_status')
      .upsert(pipelineRecords, {
        onConflict: 'prospect_id'
      });

    if (error) {
      console.error('Error updating pipeline status:', error);
      return NextResponse.json(
        { error: 'Failed to update pipeline status', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Updated status to "${status}" for ${ids.length} prospects`,
      updated: ids.length
    });

  } catch (error) {
    console.error('Error in bulk status update:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
