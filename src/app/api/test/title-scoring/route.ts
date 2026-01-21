import { NextResponse } from 'next/server';
import { calculateICPScoreWithBreakdown } from '@/lib/import';
import type { Prospect } from '@/types';

interface TitleTestCase {
  name: string;
  jobTitle: string;
  headline?: string;
  expectedScore: number;
}

export async function GET() {
  // Test cases from the user's requirements
  const testCases: TitleTestCase[] = [
    // TIER 1: 40 points - Top Decision Makers
    { name: 'Glenn Silbert', jobTitle: 'Chief Executive Officer', expectedScore: 40 },
    { name: 'Rose Cabasso', jobTitle: 'Chief Executive Officer', expectedScore: 40 },
    { name: 'Test CEO', jobTitle: 'CEO', expectedScore: 40 },
    { name: 'Test ceo lowercase', jobTitle: 'ceo', expectedScore: 40 },
    { name: 'Test CEO & Founder', jobTitle: 'CEO & Founder', expectedScore: 40 },
    { name: 'Test Co-Founder & CEO', jobTitle: 'Co-Founder & CEO', expectedScore: 40 },
    { name: 'Test Founder', jobTitle: 'Founder', expectedScore: 40 },
    { name: 'Test Co-Founder', jobTitle: 'Co-Founder', expectedScore: 40 },
    { name: 'Test Owner', jobTitle: 'Owner', expectedScore: 40 },
    { name: 'Test COO', jobTitle: 'COO', expectedScore: 40 },
    { name: 'Test Chief Operating Officer', jobTitle: 'Chief Operating Officer', expectedScore: 40 },
    { name: 'Test President', jobTitle: 'President', expectedScore: 40 },
    { name: 'Test Managing Partner', jobTitle: 'Managing Partner', expectedScore: 40 },
    { name: 'Test General Partner', jobTitle: 'General Partner', expectedScore: 40 },
    { name: 'Test CEO at Company', jobTitle: 'Chief Executive Officer at TRUEWERK', expectedScore: 40 },
    { name: 'Test President & CEO', jobTitle: 'President & CEO', expectedScore: 40 },

    // TIER 2: 30 points - Partners (but not managing/general)
    { name: 'Test Partner', jobTitle: 'Partner', expectedScore: 30 },
    { name: 'Test Senior Partner', jobTitle: 'Senior Partner', expectedScore: 30 },

    // TIER 3: 25 points - Senior Leaders
    { name: 'Diana Takach', jobTitle: 'Chief Growth Officer', expectedScore: 25 },
    { name: 'Bob Ludeman', jobTitle: 'Chief Commercial Officer (CCO)', expectedScore: 25 },
    { name: 'Test CMO', jobTitle: 'Chief Marketing Officer', expectedScore: 25 },
    { name: 'Test CTO', jobTitle: 'Chief Technology Officer', expectedScore: 25 },
    { name: 'Test CRO', jobTitle: 'Chief Revenue Officer', expectedScore: 25 },
    { name: 'Test VP Marketing', jobTitle: 'VP Marketing', expectedScore: 25 },
    { name: 'Test VP of Sales', jobTitle: 'VP of Sales', expectedScore: 25 },
    { name: 'Test Vice President', jobTitle: 'Vice President of Operations', expectedScore: 25 },
    { name: 'Test Head of Marketing', jobTitle: 'Head of Marketing', expectedScore: 25 },
    { name: 'Test Head of Sales', jobTitle: 'Head of Sales', expectedScore: 25 },
    { name: 'Test Director of Partnerships', jobTitle: 'Director of Partnerships', expectedScore: 25 },
    { name: 'Test Director of Client Success', jobTitle: 'Director of Client Success', expectedScore: 25 },

    // TIER 4: 15 points - Directors
    { name: 'Test Director', jobTitle: 'Director of Engineering', expectedScore: 15 },
    { name: 'Test Marketing Director', jobTitle: 'Marketing Director', expectedScore: 15 },
    { name: 'Test General Manager', jobTitle: 'General Manager', expectedScore: 15 },

    // TIER 5: 10 points - Senior ICs
    { name: 'Test Senior Manager', jobTitle: 'Senior Manager', expectedScore: 10 },
    { name: 'Test Team Lead', jobTitle: 'Team Lead', expectedScore: 10 },
    { name: 'Test Senior Developer', jobTitle: 'Senior Software Developer', expectedScore: 10 },

    // TIER 0: 0 points - Everyone else
    { name: 'Test Software Engineer', jobTitle: 'Software Engineer', expectedScore: 0 },
    { name: 'Test Analyst', jobTitle: 'Business Analyst', expectedScore: 0 },
    { name: 'Test Coordinator', jobTitle: 'Marketing Coordinator', expectedScore: 0 },
  ];

  const results: Array<{
    name: string;
    jobTitle: string;
    expectedScore: number;
    actualScore: number;
    passed: boolean;
    segment: string;
    totalICP: number;
  }> = [];

  let passed = 0;
  let failed = 0;

  console.log('\n========================================');
  console.log('TITLE AUTHORITY SCORING TEST RESULTS');
  console.log('========================================\n');

  for (const testCase of testCases) {
    const prospect: Partial<Prospect> = {
      fullName: testCase.name,
      jobTitle: testCase.jobTitle,
      headline: testCase.headline || testCase.jobTitle,
      companyName: 'Test Company',
      aboutSummary: 'DTC brand selling products on Shopify',
      companyIndustry: 'Retail',
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const isPassed = breakdown.titleAuthority === testCase.expectedScore;

    if (isPassed) {
      passed++;
    } else {
      failed++;
    }

    const status = isPassed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | ${testCase.name}`);
    console.log(`       Job Title: "${testCase.jobTitle}"`);
    console.log(`       Expected: ${testCase.expectedScore} pts | Actual: ${breakdown.titleAuthority} pts`);
    if (!isPassed) {
      console.log(`       ^^^ MISMATCH ^^^`);
    }
    console.log('');

    results.push({
      name: testCase.name,
      jobTitle: testCase.jobTitle,
      expectedScore: testCase.expectedScore,
      actualScore: breakdown.titleAuthority,
      passed: isPassed,
      segment: breakdown.segment,
      totalICP: breakdown.total
    });
  }

  console.log('========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  // Special focus on the bug cases
  console.log('\n========================================');
  console.log('BUG FIX VERIFICATION - Key Cases');
  console.log('========================================');

  const bugCases = [
    { name: 'Glenn Silbert', title: 'Chief Executive Officer', company: 'TRUEWERK' },
    { name: 'Rose Cabasso', title: 'Chief Executive Officer', company: 'Unknown' },
    { name: 'Diana Takach', title: 'Chief Growth Officer', company: 'Test' },
    { name: 'Bob Ludeman', title: 'Chief Commercial Officer (CCO)', company: 'Test' },
  ];

  for (const bugCase of bugCases) {
    const prospect: Partial<Prospect> = {
      fullName: bugCase.name,
      jobTitle: bugCase.title,
      companyName: bugCase.company,
      aboutSummary: 'DTC brand selling products on Shopify',
      companyIndustry: 'Retail',
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const expectedScore = bugCase.title.toLowerCase().includes('chief executive') ? 40 : 25;
    const status = breakdown.titleAuthority === expectedScore ? '✓ FIXED' : '✗ STILL BROKEN';

    console.log(`\n${bugCase.name} - "${bugCase.title}"`);
    console.log(`  Expected: ${expectedScore} pts | Actual: ${breakdown.titleAuthority} pts`);
    console.log(`  Segment: ${breakdown.segment}`);
    console.log(`  Total ICP: ${breakdown.total}`);
    console.log(`  Status: ${status}`);
  }

  return NextResponse.json({
    summary: {
      total: testCases.length,
      passed,
      failed,
      passRate: `${((passed / testCases.length) * 100).toFixed(1)}%`
    },
    results,
    failedTests: results.filter(r => !r.passed)
  });
}
