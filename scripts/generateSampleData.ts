/**
 * Generate sample time series data with realistic patterns
 * Base: 100
 * Yearly trend: +200/year
 * Weekday variance: 10
 * Weekend variance: 20
 */

function generateSampleData() {
  const startDate = new Date('2022-01-01');
  const endDate = new Date('2024-10-15');

  const rows: string[] = ['date,numerator,denominator'];

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Calculate days since start
    const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const yearsSinceStart = daysSinceStart / 365.25;

    // Base value + trend
    const baseValue = 100 + (yearsSinceStart * 200);

    // Day of week seasonality (0 = Sunday, 6 = Saturday)
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Variance based on weekend/weekday
    const variance = isWeekend ? 20 : 10;

    // Random variance (normal distribution approximation using Box-Muller transform)
    const u1 = Math.random();
    const u2 = Math.random();
    const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const randomVariance = normalRandom * variance;

    // Final value
    const value = Math.round(baseValue + randomVariance);

    // Format date as YYYY-MM-DD
    const dateStr = currentDate.toISOString().split('T')[0];

    rows.push(`${dateStr},${value},1`);

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return rows.join('\n');
}

// Generate and output
const csvData = generateSampleData();
console.log(csvData);
