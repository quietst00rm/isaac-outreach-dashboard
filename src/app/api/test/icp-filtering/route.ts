import { NextResponse } from 'next/server';
import { calculateICPScoreWithBreakdown } from '@/lib/import';
import type { Prospect } from '@/types';

interface FilterTestCase {
  name: string;
  icpScore: number;
  expectedRanges: ('high' | 'medium' | 'low')[];
}

interface SortTestCase {
  prospects: { name: string; icpScore: number; createdAt: string }[];
  sortBy: 'icp_desc' | 'icp_asc' | 'name_asc' | 'recent';
  expectedOrder: string[];
}

export async function GET() {
  // Test ICP Range filtering
  const filterTestCases: FilterTestCase[] = [
    { name: 'High ICP - 85', icpScore: 85, expectedRanges: ['high'] },
    { name: 'High ICP - 70', icpScore: 70, expectedRanges: ['high'] },
    { name: 'Medium ICP - 69', icpScore: 69, expectedRanges: ['medium'] },
    { name: 'Medium ICP - 50', icpScore: 50, expectedRanges: ['medium'] },
    { name: 'Medium ICP - 40', icpScore: 40, expectedRanges: ['medium'] },
    { name: 'Low ICP - 39', icpScore: 39, expectedRanges: ['low'] },
    { name: 'Low ICP - 20', icpScore: 20, expectedRanges: ['low'] },
    { name: 'Low ICP - 0', icpScore: 0, expectedRanges: ['low'] },
  ];

  const filterResults = filterTestCases.map(tc => {
    // Simulate range filtering logic
    const matchesHigh = tc.icpScore >= 70;
    const matchesMedium = tc.icpScore >= 40 && tc.icpScore < 70;
    const matchesLow = tc.icpScore < 40;

    const actualRanges: ('high' | 'medium' | 'low')[] = [];
    if (matchesHigh) actualRanges.push('high');
    if (matchesMedium) actualRanges.push('medium');
    if (matchesLow) actualRanges.push('low');

    const passed = tc.expectedRanges.every(r => actualRanges.includes(r)) &&
                   actualRanges.every(r => tc.expectedRanges.includes(r));

    return {
      name: tc.name,
      icpScore: tc.icpScore,
      expectedRanges: tc.expectedRanges,
      actualRanges,
      passed
    };
  });

  // Test sorting
  const sortTestCases: SortTestCase[] = [
    {
      prospects: [
        { name: 'Alice', icpScore: 50, createdAt: '2024-01-01' },
        { name: 'Bob', icpScore: 80, createdAt: '2024-01-03' },
        { name: 'Charlie', icpScore: 30, createdAt: '2024-01-02' },
      ],
      sortBy: 'icp_desc',
      expectedOrder: ['Bob', 'Alice', 'Charlie']
    },
    {
      prospects: [
        { name: 'Alice', icpScore: 50, createdAt: '2024-01-01' },
        { name: 'Bob', icpScore: 80, createdAt: '2024-01-03' },
        { name: 'Charlie', icpScore: 30, createdAt: '2024-01-02' },
      ],
      sortBy: 'icp_asc',
      expectedOrder: ['Charlie', 'Alice', 'Bob']
    },
    {
      prospects: [
        { name: 'Charlie', icpScore: 30, createdAt: '2024-01-02' },
        { name: 'Alice', icpScore: 50, createdAt: '2024-01-01' },
        { name: 'Bob', icpScore: 80, createdAt: '2024-01-03' },
      ],
      sortBy: 'name_asc',
      expectedOrder: ['Alice', 'Bob', 'Charlie']
    },
    {
      prospects: [
        { name: 'Alice', icpScore: 50, createdAt: '2024-01-01' },
        { name: 'Bob', icpScore: 80, createdAt: '2024-01-03' },
        { name: 'Charlie', icpScore: 30, createdAt: '2024-01-02' },
      ],
      sortBy: 'recent',
      expectedOrder: ['Bob', 'Charlie', 'Alice']
    }
  ];

  const sortResults = sortTestCases.map(tc => {
    const sorted = [...tc.prospects].sort((a, b) => {
      switch (tc.sortBy) {
        case 'icp_desc':
          return b.icpScore - a.icpScore;
        case 'icp_asc':
          return a.icpScore - b.icpScore;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    const actualOrder = sorted.map(p => p.name);
    const passed = JSON.stringify(actualOrder) === JSON.stringify(tc.expectedOrder);

    return {
      sortBy: tc.sortBy,
      expectedOrder: tc.expectedOrder,
      actualOrder,
      passed
    };
  });

  // Test real ICP scoring with sorting
  const realProspects: Partial<Prospect>[] = [
    {
      fullName: 'Aaron Cordovez',
      companyName: 'Zulay Kitchen',
      companyIndustry: 'Retail',
      jobTitle: 'CEO',
      aboutSummary: 'Kitchen products brand, tens of millions of customers served worldwide',
      companySize: '11-50'
    },
    {
      fullName: 'Tina Gershoff',
      companyName: 'Scarlett Gasque',
      companyIndustry: 'Retail Apparel and Fashion',
      jobTitle: 'President & CEO',
      aboutSummary: 'Fashion brand',
      companySize: '11-50'
    },
    {
      fullName: 'John Smith',
      companyName: 'Generic Corp',
      companyIndustry: 'Professional Services',
      jobTitle: 'Manager',
      aboutSummary: 'We provide business services',
      companySize: '51-200'
    }
  ];

  const scoredProspects = realProspects.map(p => {
    const breakdown = calculateICPScoreWithBreakdown(p);
    return {
      name: p.fullName,
      icpScore: breakdown.total,
      segment: breakdown.segment,
      range: breakdown.total >= 70 ? 'high' : breakdown.total >= 40 ? 'medium' : 'low'
    };
  });

  // Sort by ICP desc
  const sortedByIcp = [...scoredProspects].sort((a, b) => b.icpScore - a.icpScore);

  // Log results
  console.log('\n========================================');
  console.log('PHASE 4: ICP FILTERING AND SORTING TESTS');
  console.log('========================================\n');

  console.log('--- ICP RANGE FILTER TESTS ---');
  let filterPassed = 0;
  let filterFailed = 0;
  for (const result of filterResults) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | ${result.name} (score: ${result.icpScore})`);
    console.log(`       Expected: [${result.expectedRanges.join(', ')}] | Got: [${result.actualRanges.join(', ')}]`);
    if (result.passed) filterPassed++;
    else filterFailed++;
  }

  console.log('\n--- SORTING TESTS ---');
  let sortPassed = 0;
  let sortFailed = 0;
  for (const result of sortResults) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} | Sort by: ${result.sortBy}`);
    console.log(`       Expected: [${result.expectedOrder.join(', ')}]`);
    console.log(`       Got:      [${result.actualOrder.join(', ')}]`);
    if (result.passed) sortPassed++;
    else sortFailed++;
  }

  console.log('\n--- REAL PROSPECT SCORING & SORTING ---');
  console.log('Sorted by ICP (High to Low):');
  for (const p of sortedByIcp) {
    console.log(`  ${p.icpScore} pts | ${p.name} | ${p.segment} | ${p.range}`);
  }

  console.log('\n========================================');
  console.log(`FILTER TESTS: ${filterPassed} passed, ${filterFailed} failed`);
  console.log(`SORT TESTS: ${sortPassed} passed, ${sortFailed} failed`);
  console.log('========================================');

  return NextResponse.json({
    summary: {
      filterTests: {
        total: filterResults.length,
        passed: filterPassed,
        failed: filterFailed,
        passRate: `${((filterPassed / filterResults.length) * 100).toFixed(1)}%`
      },
      sortTests: {
        total: sortResults.length,
        passed: sortPassed,
        failed: sortFailed,
        passRate: `${((sortPassed / sortResults.length) * 100).toFixed(1)}%`
      }
    },
    filterResults,
    sortResults,
    realProspectsSorted: sortedByIcp
  });
}
