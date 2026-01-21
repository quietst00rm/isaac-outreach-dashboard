import { NextResponse } from 'next/server';
import { calculateICPScoreWithBreakdown } from '@/lib/import';
import type { Prospect } from '@/types';

interface TitleTestCase {
  title: string;
  expectedScore: number;
  segment?: 'merchant' | 'agency';
}

interface TestResult {
  title: string;
  expectedScore: number;
  actualScore: number;
  passed: boolean;
  segment: string;
}

export async function GET() {
  const testCases: TitleTestCase[] = [
    // CEO variations - should all be +40
    { title: 'Chief Executive Officer', expectedScore: 40 },
    { title: 'CEO', expectedScore: 40 },
    { title: 'ceo', expectedScore: 40 },
    { title: 'CEO & Founder', expectedScore: 40 },
    { title: 'Co-Founder & CEO', expectedScore: 40 },
    { title: 'CEO/Founder', expectedScore: 40 },
    { title: 'President & CEO', expectedScore: 40 },
    { title: 'Chief Executive Officer at TRUEWERK', expectedScore: 40 },
    { title: 'Chief Executive Officer at Marquee Brands', expectedScore: 40 },

    // Founder variations - should all be +40
    { title: 'Founder', expectedScore: 40 },
    { title: 'Co-Founder', expectedScore: 40 },
    { title: 'Co-founder', expectedScore: 40 },
    { title: 'Cofounder', expectedScore: 40 },
    { title: 'Founder & CEO', expectedScore: 40 },

    // COO variations - should all be +40
    { title: 'COO', expectedScore: 40 },
    { title: 'Chief Operating Officer', expectedScore: 40 },
    { title: 'COO & Co-Founder', expectedScore: 40 },

    // Operations leadership for Merchants - should be +40
    { title: 'VP of Operations', expectedScore: 40 },
    { title: 'VP Operations', expectedScore: 40 },
    { title: 'Vice President of Operations', expectedScore: 40 },
    { title: 'Head of Operations', expectedScore: 40 },
    { title: 'Director of Operations', expectedScore: 40 },

    // E-commerce leadership for Merchants - should be +40
    { title: 'Head of E-commerce', expectedScore: 40 },
    { title: 'Head of Ecommerce', expectedScore: 40 },
    { title: 'VP of E-commerce', expectedScore: 40 },
    { title: 'Director of E-commerce', expectedScore: 40 },

    // Other top titles - should be +40
    { title: 'Owner', expectedScore: 40 },
    { title: 'President', expectedScore: 40 },
    { title: 'Managing Partner', expectedScore: 40 },

    // Secondary titles - should be +30
    { title: 'Operations Manager', expectedScore: 30 },
    { title: 'Head of Fulfillment', expectedScore: 30 },
    { title: 'Supply Chain Director', expectedScore: 30 },
    { title: 'E-commerce Manager', expectedScore: 30 },
    { title: 'Partner', expectedScore: 30 },
    { title: 'Principal', expectedScore: 30 },

    // Tertiary titles - should be +20
    { title: 'Director of Marketing', expectedScore: 20 },
    { title: 'Head of Sales', expectedScore: 20 },
    { title: 'VP of Sales', expectedScore: 20 },

    // Lower authority - should be +10
    { title: 'Marketing Manager', expectedScore: 10 },
    { title: 'Sales Lead', expectedScore: 10 },
    { title: 'Senior Developer', expectedScore: 10 },

    // No match - should be 0
    { title: 'Software Engineer', expectedScore: 0 },
    { title: 'Analyst', expectedScore: 0 },
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const prospect: Partial<Prospect> = {
      jobTitle: testCase.title,
      headline: '',
      companyName: testCase.segment === 'agency' ? 'Test Agency' : 'Test Company',
      aboutSummary: testCase.segment === 'agency'
        ? 'We are a Shopify agency helping clients'
        : 'DTC brand selling products on Shopify',
      companyIndustry: '',
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const isPassed = breakdown.titleAuthority === testCase.expectedScore;

    if (isPassed) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      title: testCase.title,
      expectedScore: testCase.expectedScore,
      actualScore: breakdown.titleAuthority,
      passed: isPassed,
      segment: breakdown.segment
    });
  }

  // Bug fix verification cases
  const bugCases = [
    { name: 'Glenn Silbert', title: 'Chief Executive Officer', company: 'TRUEWERK' },
    { name: 'Heath Golden', title: 'Chief Executive Officer', company: 'Marquee Brands' },
  ];

  const bugResults = bugCases.map(bugCase => {
    const prospect: Partial<Prospect> = {
      fullName: bugCase.name,
      jobTitle: bugCase.title,
      companyName: bugCase.company,
      aboutSummary: 'DTC brand selling products on Shopify',
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    return {
      name: bugCase.name,
      title: bugCase.title,
      company: bugCase.company,
      titleAuthority: breakdown.titleAuthority,
      segment: breakdown.segment,
      totalScore: breakdown.total,
      fixed: breakdown.titleAuthority === 40
    };
  });

  // Log results to server console
  console.log('\n========================================');
  console.log('TITLE AUTHORITY SCORING TEST RESULTS');
  console.log('========================================\n');

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | "${result.title}" → Expected: ${result.expectedScore}, Got: ${result.actualScore}`);
  }

  console.log('\n========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  console.log('\n========================================');
  console.log('BUG FIX VERIFICATION');
  console.log('========================================');

  for (const bug of bugResults) {
    console.log(`\n${bug.name} - ${bug.title} at ${bug.company}`);
    console.log(`  Title Authority: ${bug.titleAuthority} pts (expected: 40)`);
    console.log(`  Segment: ${bug.segment}`);
    console.log(`  Total ICP Score: ${bug.totalScore}`);
    console.log(`  Status: ${bug.fixed ? '✓ FIXED' : '✗ STILL BROKEN'}`);
  }

  return NextResponse.json({
    summary: {
      total: testCases.length,
      passed,
      failed,
      passRate: `${((passed / testCases.length) * 100).toFixed(1)}%`
    },
    bugFixVerification: bugResults,
    allResults: results,
    failedTests: results.filter(r => !r.passed)
  });
}
