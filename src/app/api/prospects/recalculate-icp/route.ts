import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateICPScoreWithBreakdown } from '@/lib/import';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch all prospects
    const { data: prospects, error: fetchError } = await supabase
      .from('prospects')
      .select('*');

    if (fetchError) {
      console.error('Error fetching prospects:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch prospects', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prospects to update',
        updated: 0
      });
    }

    // Recalculate ICP scores for each prospect
    let updated = 0;
    const errors: string[] = [];

    for (const prospect of prospects) {
      // Transform DB record to app format for scoring
      const prospectData = {
        firstName: prospect.first_name,
        lastName: prospect.last_name,
        fullName: prospect.full_name,
        linkedinUrl: prospect.linkedin_url,
        headline: prospect.headline,
        aboutSummary: prospect.about_summary,
        companyName: prospect.company_name,
        companyIndustry: prospect.company_industry,
        companySize: prospect.company_size,
        jobTitle: prospect.job_title,
        location: prospect.location,
        careerHistory: prospect.career_history || [],
        recentPosts: prospect.recent_posts || [],
      };

      // Calculate new ICP score
      const icpBreakdown = calculateICPScoreWithBreakdown(prospectData);

      // Update the prospect in the database
      const { error: updateError } = await supabase
        .from('prospects')
        .update({
          icp_score: icpBreakdown.total,
          icp_score_breakdown: icpBreakdown,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      if (updateError) {
        errors.push(`Failed to update ${prospect.full_name}: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated ICP scores for ${updated} prospects`,
      updated,
      total: prospects.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error recalculating ICP scores:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
