import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ResponseClassification, ResponseOption } from '@/types';

// Initialize Supabase client if configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

interface LogResponseRequest {
  prospectId: string;
  prospectResponse: string;
  classification: ResponseClassification;
  classificationOverridden: boolean;
  originalClassification?: ResponseClassification;
  generatedResponses: ResponseOption[];
  selectedResponse?: string;
  selectedStyle?: 'direct' | 'soft' | 'question_first';
}

export async function POST(request: NextRequest) {
  try {
    const body: LogResponseRequest = await request.json();

    const {
      prospectId,
      prospectResponse,
      classification,
      classificationOverridden,
      originalClassification,
      generatedResponses,
      selectedResponse,
      selectedStyle
    } = body;

    if (!prospectId || !prospectResponse || !classification) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const logEntry = {
      id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prospect_id: prospectId,
      prospect_response: prospectResponse,
      classification,
      classification_overridden: classificationOverridden,
      original_classification: originalClassification,
      generated_responses: generatedResponses,
      selected_response: selectedResponse,
      selected_style: selectedStyle,
      created_at: new Date().toISOString()
    };

    // Try to save to Supabase if configured
    if (supabase) {
      const { error } = await supabase
        .from('response_interactions')
        .insert(logEntry);

      if (error) {
        // Table might not exist, log to console instead
        console.log('Response interaction (Supabase unavailable):', JSON.stringify(logEntry, null, 2));
      }
    } else {
      // Log to console for tracking
      console.log('Response interaction logged:', JSON.stringify(logEntry, null, 2));
    }

    return NextResponse.json({ success: true, id: logEntry.id });
  } catch (error) {
    console.error('Error logging response:', error);
    return NextResponse.json(
      { error: 'Failed to log response' },
      { status: 500 }
    );
  }
}

// Get response interaction logs (for analytics)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prospectId = searchParams.get('prospectId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!supabase) {
      return NextResponse.json({
        interactions: [],
        message: 'Supabase not configured - logs are only in server console'
      });
    }

    let query = supabase
      .from('response_interactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (prospectId) {
      query = query.eq('prospect_id', prospectId);
    }

    const { data, error } = await query;

    if (error) {
      // Table might not exist
      return NextResponse.json({
        interactions: [],
        message: 'Response interactions table not found'
      });
    }

    return NextResponse.json({ interactions: data || [] });
  } catch (error) {
    console.error('Error fetching response logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch response logs' },
      { status: 500 }
    );
  }
}
