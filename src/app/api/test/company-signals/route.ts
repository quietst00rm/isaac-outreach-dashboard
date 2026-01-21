import { NextResponse } from 'next/server';
import { calculateICPScoreWithBreakdown } from '@/lib/import';
import type { Prospect } from '@/types';

interface SignalTestCase {
  name: string;
  companyName: string;
  industry?: string;
  headline?: string;
  about?: string;
  jobTitle?: string;
  expectedMinSignals: number;
  description: string;
}

interface TestResult {
  name: string;
  description: string;
  companySignals: number;
  expectedMinSignals: number;
  passed: boolean;
  segment: string;
  totalScore: number;
  breakdown: {
    titleAuthority: number;
    companySignals: number;
    companySize: number;
    productCategory: number;
    profileCompleteness: number;
  };
}

export async function GET() {
  const testCases: SignalTestCase[] = [
    // ========================================
    // SCALE INDICATOR TESTS
    // ========================================
    {
      name: 'Aaron Cordovez',
      companyName: 'Zulay Kitchen',
      industry: 'Retail',
      jobTitle: 'CEO',
      headline: 'CEO at Zulay Kitchen',
      about: 'Kitchen products brand, tens of millions of customers served worldwide',
      expectedMinSignals: 25,
      description: 'Scale: "tens of millions of customers" + Industry: Retail'
    },
    {
      name: 'Scale Test - Millions',
      companyName: 'Big Brand Co',
      industry: 'Consumer Goods',
      jobTitle: 'Founder',
      about: 'Over 5 million customers and $50M in revenue',
      expectedMinSignals: 20,
      description: 'Scale: "5 million customers" + "$50M" revenue'
    },
    {
      name: 'Scale Test - Inc 5000',
      companyName: 'Fast Growth Inc',
      industry: 'Retail',
      jobTitle: 'CEO',
      about: 'Inc 5000 fastest growing company, 8-figure revenue',
      expectedMinSignals: 25,
      description: 'Scale: "Inc 5000" + "8-figure revenue"'
    },
    {
      name: 'Scale Test - Bestseller',
      companyName: 'Top Seller Brand',
      industry: 'Consumer Goods',
      jobTitle: 'Founder',
      about: 'Our products are #1 bestseller on Amazon',
      expectedMinSignals: 20,
      description: 'Scale: "bestseller" + "Amazon"'
    },

    // ========================================
    // PLATFORM SIGNAL TESTS
    // ========================================
    {
      name: 'Platform Test - Shopify Plus',
      companyName: 'Premium Store',
      industry: 'Retail',
      jobTitle: 'Founder',
      about: 'Running our DTC brand on Shopify Plus',
      expectedMinSignals: 25,
      description: 'Platform: "Shopify Plus" + DTC + Industry'
    },
    {
      name: 'Platform Test - Amazon FBA',
      companyName: 'Amazon Brand',
      industry: 'Consumer Goods',
      jobTitle: 'Owner',
      about: 'Amazon FBA seller with multiple private label brands',
      expectedMinSignals: 20,
      description: 'Platform: "Amazon FBA" + "brands" + Industry'
    },
    {
      name: 'Platform Test - Multiple',
      companyName: 'Multi-Channel',
      industry: 'Retail',
      jobTitle: 'CEO',
      about: 'Selling on Shopify, Amazon, and BigCommerce',
      expectedMinSignals: 25,
      description: 'Platform: Shopify + Amazon + BigCommerce + Industry'
    },

    // ========================================
    // INDUSTRY BONUS TESTS
    // ========================================
    {
      name: 'Tina Gershoff',
      companyName: 'Scarlett Gasque',
      industry: 'Retail Apparel and Fashion',
      jobTitle: 'President & CEO',
      about: 'Fashion brand',
      expectedMinSignals: 15,
      description: 'Industry: "Retail Apparel and Fashion" merchant bonus'
    },
    {
      name: 'Industry Test - Food',
      companyName: 'Food Brand Co',
      industry: 'Food & Beverages',
      jobTitle: 'Founder',
      about: 'Consumer food products',
      expectedMinSignals: 15,
      description: 'Industry: "Food & Beverages" merchant bonus'
    },

    // ========================================
    // DTC / E-COMMERCE TESTS
    // ========================================
    {
      name: 'DTC Test',
      companyName: 'DTC Brand',
      industry: '',
      jobTitle: 'Founder',
      about: 'Direct-to-consumer e-commerce brand',
      expectedMinSignals: 15,
      description: 'DTC: "direct-to-consumer" + "e-commerce"'
    },
    {
      name: 'Ecommerce Test',
      companyName: 'Online Shop Co',
      industry: '',
      jobTitle: 'Owner',
      about: 'Online store selling physical products',
      expectedMinSignals: 10,
      description: 'General: "online store" + "physical products"'
    },

    // ========================================
    // BASELINE / NO SIGNALS
    // ========================================
    {
      name: 'No Signals Test',
      companyName: 'Generic Corp',
      industry: 'Professional Services',
      jobTitle: 'Manager',
      about: 'We provide business services',
      expectedMinSignals: 0,
      description: 'Baseline: No commerce signals'
    },

    // ========================================
    // AGENCY TESTS
    // ========================================
    {
      name: 'Agency Test - Shopify Partner',
      companyName: 'Growth Agency',
      industry: 'Marketing and Advertising',
      jobTitle: 'Founder',
      about: 'Shopify Plus partner agency helping brands grow',
      expectedMinSignals: 20,
      description: 'Agency: "Shopify Plus partner" + "brands"'
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
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);
    const isPassed = breakdown.companySignals >= testCase.expectedMinSignals;

    if (isPassed) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      name: testCase.name,
      description: testCase.description,
      companySignals: breakdown.companySignals,
      expectedMinSignals: testCase.expectedMinSignals,
      passed: isPassed,
      segment: breakdown.segment,
      totalScore: breakdown.total,
      breakdown: {
        titleAuthority: breakdown.titleAuthority,
        companySignals: breakdown.companySignals,
        companySize: breakdown.companySize,
        productCategory: breakdown.productCategory,
        profileCompleteness: breakdown.profileCompleteness
      }
    });
  }

  // Log results to server console
  console.log('\n========================================');
  console.log('COMPANY SIGNALS SCORING TEST RESULTS');
  console.log('========================================\n');

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | ${result.name}`);
    console.log(`       ${result.description}`);
    console.log(`       Company Signals: ${result.companySignals} pts (min expected: ${result.expectedMinSignals})`);
    console.log(`       Segment: ${result.segment} | Total: ${result.totalScore}`);
    console.log('');
  }

  console.log('========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  // Detailed breakdown for key prospects
  console.log('\n========================================');
  console.log('DETAILED BREAKDOWNS');
  console.log('========================================');

  const keyProspects = [
    {
      name: 'Aaron Cordovez',
      company: 'Zulay Kitchen',
      industry: 'Retail',
      title: 'CEO',
      about: 'Kitchen products brand, tens of millions of customers served worldwide'
    },
    {
      name: 'Tina Gershoff',
      company: 'Scarlett Gasque',
      industry: 'Retail Apparel and Fashion',
      title: 'President & CEO',
      about: 'Fashion brand'
    }
  ];

  const detailedResults = keyProspects.map(p => {
    const prospect: Partial<Prospect> = {
      fullName: p.name,
      companyName: p.company,
      companyIndustry: p.industry,
      jobTitle: p.title,
      headline: p.title,
      aboutSummary: p.about,
      companySize: '11-50'
    };

    const breakdown = calculateICPScoreWithBreakdown(prospect);

    console.log(`\n${p.name} - ${p.title} at ${p.company}`);
    console.log(`  Industry: ${p.industry}`);
    console.log(`  About: "${p.about}"`);
    console.log(`  ----------------------------------------`);
    console.log(`  Segment: ${breakdown.segment}`);
    console.log(`  Title Authority: ${breakdown.titleAuthority} pts`);
    console.log(`  Company Signals: ${breakdown.companySignals} pts`);
    console.log(`  Company Size: ${breakdown.companySize} pts`);
    console.log(`  Product Category: ${breakdown.productCategory} pts`);
    console.log(`  Profile Complete: ${breakdown.profileCompleteness} pts`);
    console.log(`  ----------------------------------------`);
    console.log(`  TOTAL ICP SCORE: ${breakdown.total}`);

    return {
      name: p.name,
      company: p.company,
      industry: p.industry,
      segment: breakdown.segment,
      breakdown: {
        titleAuthority: breakdown.titleAuthority,
        companySignals: breakdown.companySignals,
        companySize: breakdown.companySize,
        productCategory: breakdown.productCategory,
        profileCompleteness: breakdown.profileCompleteness,
        total: breakdown.total
      }
    };
  });

  return NextResponse.json({
    summary: {
      total: testCases.length,
      passed,
      failed,
      passRate: `${((passed / testCases.length) * 100).toFixed(1)}%`
    },
    detailedBreakdowns: detailedResults,
    allResults: results,
    failedTests: results.filter(r => !r.passed)
  });
}
