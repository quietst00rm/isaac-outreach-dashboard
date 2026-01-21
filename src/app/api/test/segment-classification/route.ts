import { NextResponse } from 'next/server';
import { calculateICPScoreWithBreakdown } from '@/lib/import';
import type { Prospect } from '@/types';

interface SegmentTestCase {
  name: string;
  companyName: string;
  industry?: string;
  headline?: string;
  about?: string;
  jobTitle?: string;
  companySize?: string;
  expectedSegment: 'merchant' | 'agency' | 'freelancer';
}

interface TestResult {
  name: string;
  companyName: string;
  industry: string;
  expectedSegment: string;
  actualSegment: string;
  passed: boolean;
  totalScore: number;
}

export async function GET() {
  const testCases: SegmentTestCase[] = [
    // ========================================
    // MERCHANT TEST CASES - Industry-based
    // ========================================
    {
      name: 'Aaron Cordovez',
      companyName: 'Zulay Kitchen',
      industry: 'Retail',
      jobTitle: 'CEO',
      about: 'Kitchen products brand with millions of customers',
      expectedSegment: 'merchant'
    },
    {
      name: 'Tina Gershoff',
      companyName: 'Scarlett Gasque',
      industry: 'Retail Apparel and Fashion',
      jobTitle: 'President & CEO',
      about: 'Retail fashion brand',
      expectedSegment: 'merchant'
    },
    {
      name: 'Sara S.',
      companyName: 'Sera Swimwear',
      industry: 'Retail Apparel and Fashion',
      jobTitle: 'Founder',
      about: 'Swimwear brand',
      expectedSegment: 'merchant'
    },
    {
      name: 'Brenna Lyden',
      companyName: 'East West Gem Co.',
      industry: 'Jewelry',
      jobTitle: 'CEO',
      about: 'Jewelry brand',
      expectedSegment: 'merchant'
    },
    {
      name: 'Glenn Silbert',
      companyName: 'TRUEWERK',
      industry: 'Retail Apparel and Fashion',
      jobTitle: 'Chief Executive Officer',
      about: 'Performance workwear brand',
      expectedSegment: 'merchant'
    },
    {
      name: 'Heath Golden',
      companyName: 'Marquee Brands',
      industry: 'Consumer Goods',
      jobTitle: 'Chief Executive Officer',
      about: 'Consumer brands portfolio',
      expectedSegment: 'merchant'
    },

    // ========================================
    // MERCHANT TEST CASES - Keyword-based
    // ========================================
    {
      name: 'John Smith',
      companyName: 'Acme Products',
      industry: 'Manufacturing',
      jobTitle: 'Founder',
      about: 'We sell products on Shopify and Amazon',
      expectedSegment: 'merchant'
    },
    {
      name: 'Jane Doe',
      companyName: 'DTC Brand Co',
      industry: '',
      jobTitle: 'CEO',
      about: 'Direct-to-consumer brand',
      expectedSegment: 'merchant'
    },
    {
      name: 'Test User',
      companyName: 'Kitchen Goods Inc',
      industry: '',
      jobTitle: 'Owner',
      about: '',
      expectedSegment: 'merchant'
    },

    // ========================================
    // AGENCY TEST CASES
    // ========================================
    {
      name: 'Agency Owner',
      companyName: 'XYZ Marketing Agency',
      industry: 'Marketing and Advertising',
      jobTitle: 'CEO',
      about: 'We help brands grow through digital marketing',
      expectedSegment: 'agency'
    },
    {
      name: 'Partner Person',
      companyName: 'Shopify Partners Inc',
      industry: 'Information Technology',
      jobTitle: 'Managing Partner',
      about: 'Shopify partner agency helping clients succeed',
      expectedSegment: 'agency'
    },
    {
      name: 'Consultant Lead',
      companyName: 'Growth Consulting Group',
      industry: 'Management Consulting',
      jobTitle: 'Founder',
      about: 'E-commerce consulting for brands',
      expectedSegment: 'agency'
    },

    // ========================================
    // FREELANCER TEST CASES
    // ========================================
    {
      name: 'Solo Worker',
      companyName: 'Self-Employed',
      industry: '',
      jobTitle: 'Freelance Consultant',
      about: 'Independent consultant',
      companySize: 'Self-employed',
      expectedSegment: 'freelancer'
    },
    {
      name: 'Independent Person',
      companyName: '',
      industry: '',
      jobTitle: 'Independent Contractor',
      about: '',
      expectedSegment: 'freelancer'
    },
    {
      name: 'Freelancer Test',
      companyName: 'Freelance',
      industry: '',
      jobTitle: 'Freelance Developer',
      about: '',
      expectedSegment: 'freelancer'
    },

    // ========================================
    // EDGE CASES - Should default to Merchant
    // ========================================
    {
      name: 'Unclear Business',
      companyName: 'Acme Corp',
      industry: '',
      jobTitle: 'CEO',
      about: '',
      expectedSegment: 'merchant'
    },
    {
      name: 'Minimal Info',
      companyName: 'Some Company',
      industry: '',
      jobTitle: 'Founder',
      about: '',
      expectedSegment: 'merchant'
    }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const prospect: Partial<Prospect> = {
      fullName: testCase.name,
      companyName: testCase.companyName,
      companyIndustry: testCase.industry,
      jobTitle: testCase.jobTitle,
      headline: testCase.headline || testCase.jobTitle,
      aboutSummary: testCase.about,
      companySize: testCase.companySize
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const isPassed = breakdown.segment === testCase.expectedSegment;

    if (isPassed) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      name: testCase.name,
      companyName: testCase.companyName,
      industry: testCase.industry || '(none)',
      expectedSegment: testCase.expectedSegment,
      actualSegment: breakdown.segment,
      passed: isPassed,
      totalScore: breakdown.total
    });
  }

  // Log results to server console
  console.log('\n========================================');
  console.log('SEGMENT CLASSIFICATION TEST RESULTS');
  console.log('========================================\n');

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | ${result.name} @ ${result.companyName}`);
    console.log(`       Industry: ${result.industry}`);
    console.log(`       Expected: ${result.expectedSegment} | Got: ${result.actualSegment}`);
    console.log('');
  }

  console.log('========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  // Bug fix verification - specific cases mentioned in the issue
  console.log('\n========================================');
  console.log('BUG FIX VERIFICATION');
  console.log('========================================');

  const bugCases = [
    { name: 'Aaron Cordovez', company: 'Zulay Kitchen', industry: 'Retail', title: 'CEO' },
    { name: 'Tina Gershoff', company: 'Scarlett Gasque', industry: 'Retail Apparel and Fashion', title: 'President/CEO' },
    { name: 'Sara S.', company: 'Sera Swimwear', industry: 'Retail Apparel and Fashion', title: 'Founder' },
    { name: 'Brenna Lyden', company: 'East West Gem Co.', industry: 'Jewelry', title: 'CEO' },
  ];

  const bugResults = bugCases.map(bugCase => {
    const prospect: Partial<Prospect> = {
      fullName: bugCase.name,
      companyName: bugCase.company,
      companyIndustry: bugCase.industry,
      jobTitle: bugCase.title,
      aboutSummary: 'DTC brand selling products'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const fixed = breakdown.segment === 'merchant';

    console.log(`\n${bugCase.name} - ${bugCase.title} at ${bugCase.company}`);
    console.log(`  Industry: ${bugCase.industry}`);
    console.log(`  Segment: ${breakdown.segment} (expected: merchant)`);
    console.log(`  Total ICP Score: ${breakdown.total}`);
    console.log(`  Status: ${fixed ? '✓ FIXED' : '✗ STILL BROKEN'}`);

    return {
      name: bugCase.name,
      company: bugCase.company,
      industry: bugCase.industry,
      segment: breakdown.segment,
      totalScore: breakdown.total,
      fixed
    };
  });

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
