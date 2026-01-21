import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Helper to escape CSV fields
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse query params for optional filtering
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status');
    const filterSegment = searchParams.get('segment');
    const filterIcpRange = searchParams.get('icpRange');
    const filterSearch = searchParams.get('search');

    // Build query
    let query = supabase
      .from('prospects')
      .select(`
        id,
        full_name,
        linkedin_url,
        headline,
        job_title,
        company_name,
        company_industry,
        company_size,
        about_summary,
        location,
        icp_score,
        icp_score_breakdown,
        created_at,
        pipeline:pipeline_status(status)
      `)
      .order('icp_score', { ascending: false });

    // Apply filters if provided
    if (filterSearch) {
      query = query.or(`full_name.ilike.%${filterSearch}%,company_name.ilike.%${filterSearch}%,job_title.ilike.%${filterSearch}%`);
    }

    const { data: prospects, error } = await query;

    if (error) {
      console.error('Error fetching prospects for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prospects', details: error.message },
        { status: 500 }
      );
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json(
        { error: 'No prospects to export' },
        { status: 404 }
      );
    }

    // Apply additional filters that can't be done in Supabase query
    let filteredProspects = prospects;

    if (filterStatus && filterStatus !== 'all') {
      filteredProspects = filteredProspects.filter(p => {
        const pipelineArray = p.pipeline as { status: string }[] | null;
        const status = pipelineArray?.[0]?.status || 'not_contacted';
        return status === filterStatus;
      });
    }

    if (filterSegment && filterSegment !== 'all') {
      filteredProspects = filteredProspects.filter(p => {
        const breakdown = p.icp_score_breakdown as { segment?: string } | null;
        return breakdown?.segment === filterSegment;
      });
    }

    if (filterIcpRange && filterIcpRange !== 'all') {
      filteredProspects = filteredProspects.filter(p => {
        const score = p.icp_score || 0;
        if (filterIcpRange === 'high') return score >= 70;
        if (filterIcpRange === 'medium') return score >= 40 && score < 70;
        if (filterIcpRange === 'low') return score < 40;
        return true;
      });
    }

    // CSV Headers
    const headers = [
      'id',
      'full_name',
      'linkedin_url',
      'headline',
      'job_title',
      'company_name',
      'company_industry',
      'company_size',
      'about_summary',
      'location',
      'segment',
      'icp_score',
      'icp_title_authority',
      'icp_company_signals',
      'icp_company_size',
      'icp_product_category',
      'icp_profile_completeness',
      'pipeline_status',
      'created_at'
    ];

    // Build CSV rows
    const rows: string[] = [headers.join(',')];

    for (const prospect of filteredProspects) {
      // Extract ICP breakdown fields
      const breakdown = prospect.icp_score_breakdown as {
        segment?: string;
        titleAuthority?: number;
        companySignals?: number;
        companySize?: number;
        productCategory?: number;
        profileCompleteness?: number;
      } | null;

      // Get pipeline status
      const pipelineArray = prospect.pipeline as { status: string }[] | null;
      const pipelineStatus = pipelineArray?.[0]?.status || 'not_contacted';

      const row = [
        escapeCSV(prospect.id),
        escapeCSV(prospect.full_name),
        escapeCSV(prospect.linkedin_url),
        escapeCSV(prospect.headline),
        escapeCSV(prospect.job_title),
        escapeCSV(prospect.company_name),
        escapeCSV(prospect.company_industry),
        escapeCSV(prospect.company_size),
        escapeCSV(prospect.about_summary),
        escapeCSV(prospect.location),
        escapeCSV(breakdown?.segment || ''),
        escapeCSV(prospect.icp_score),
        escapeCSV(breakdown?.titleAuthority),
        escapeCSV(breakdown?.companySignals),
        escapeCSV(breakdown?.companySize),
        escapeCSV(breakdown?.productCategory),
        escapeCSV(breakdown?.profileCompleteness),
        escapeCSV(pipelineStatus),
        escapeCSV(prospect.created_at)
      ];

      rows.push(row.join(','));
    }

    const csvContent = rows.join('\n');

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `isaac-outreach-export-${date}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting prospects:', error);
    return NextResponse.json(
      { error: 'Failed to export prospects', details: String(error) },
      { status: 500 }
    );
  }
}
