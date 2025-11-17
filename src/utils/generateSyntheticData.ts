import type { Series } from '../types/series';
import { addDays } from 'date-fns';

interface SyntheticMetricConfig {
  name: string;
  description: string;
  baseValue: number;
  trend: number; // daily change
  seasonality: number; // amplitude of seasonal variation
  noise: number; // random noise amplitude
  denominator: number; // constant denominator for rate metrics
}

const METRIC_CONFIGS: SyntheticMetricConfig[] = [
  {
    name: 'Customer Satisfaction Score',
    description: 'Daily customer satisfaction rating (0-100)',
    baseValue: 75,
    trend: 0.01,
    seasonality: 5,
    noise: 3,
    denominator: 100
  },
  {
    name: 'Daily Active Users',
    description: 'Number of active users per day',
    baseValue: 5000,
    trend: 5,
    seasonality: 800,
    noise: 200,
    denominator: 10000
  },
  {
    name: 'Revenue per Customer',
    description: 'Average revenue per customer ($)',
    baseValue: 45,
    trend: 0.02,
    seasonality: 8,
    noise: 5,
    denominator: 100
  },
  {
    name: 'Page Load Time',
    description: 'Average page load time (seconds)',
    baseValue: 2.5,
    trend: -0.001, // improving over time
    seasonality: 0.3,
    noise: 0.2,
    denominator: 10
  },
  {
    name: 'Conversion Rate',
    description: 'Percentage of visitors who convert',
    baseValue: 3.2,
    trend: 0.005,
    seasonality: 0.5,
    noise: 0.3,
    denominator: 100
  },
  {
    name: 'Support Ticket Volume',
    description: 'Number of support tickets received',
    baseValue: 120,
    trend: -0.05, // decreasing over time
    seasonality: 20,
    noise: 15,
    denominator: 200
  },
  {
    name: 'API Response Time',
    description: 'Average API response time (ms)',
    baseValue: 150,
    trend: -0.02,
    seasonality: 25,
    noise: 20,
    denominator: 500
  },
  {
    name: 'Churn Rate',
    description: 'Monthly customer churn rate (%)',
    baseValue: 5.5,
    trend: -0.002, // improving (decreasing)
    seasonality: 0.8,
    noise: 0.4,
    denominator: 100
  },
  {
    name: 'Feature Adoption Rate',
    description: 'Percentage of users adopting new features',
    baseValue: 25,
    trend: 0.03,
    seasonality: 5,
    noise: 3,
    denominator: 100
  },
  {
    name: 'Server Uptime',
    description: 'Percentage of server uptime',
    baseValue: 99.5,
    trend: 0.0005,
    seasonality: 0.2,
    noise: 0.1,
    denominator: 100
  }
];

function generateValue(
  config: SyntheticMetricConfig,
  dayIndex: number
): number {
  const { baseValue, trend, seasonality, noise } = config;

  // Linear trend
  const trendValue = baseValue + (trend * dayIndex);

  // Seasonal variation (yearly cycle)
  const seasonalValue = seasonality * Math.sin((dayIndex / 365) * 2 * Math.PI);

  // Random noise
  const noiseValue = (Math.random() - 0.5) * 2 * noise;

  // Weekly pattern (higher on weekdays, lower on weekends)
  const dayOfWeek = dayIndex % 7;
  const weeklyFactor = (dayOfWeek < 5) ? 1.0 : 0.85;

  const value = (trendValue + seasonalValue + noiseValue) * weeklyFactor;

  // Ensure positive values
  return Math.max(value, 0.1);
}

export function generateSyntheticMetrics(): Series[] {
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2); // Start 2.5 years ago
  startDate.setMonth(startDate.getMonth() - 6);

  const daysToGenerate = Math.floor(2.5 * 365); // 2.5 years of daily data

  return METRIC_CONFIGS.map((config, metricIndex) => {
    const data = [];

    for (let i = 0; i < daysToGenerate; i++) {
      const date = addDays(startDate, i);
      const numerator = generateValue(config, i);
      const denominator = config.denominator;

      data.push({
        date,
        numerator,
        denominator
      });
    }

    const series: Series = {
      id: `synthetic-${metricIndex}-${Date.now()}`,
      data,
      metadata: {
        name: config.name,
        description: config.description,
        uploadDate: new Date(),
        numeratorLabel: 'Value',
        denominatorLabel: 'Scale'
      }
    };

    return series;
  });
}

export function loadSyntheticMetrics(
  onMetricLoaded: (metric: Series) => void
): void {
  const metrics = generateSyntheticMetrics();
  metrics.forEach(metric => {
    onMetricLoaded(metric);
  });
}
