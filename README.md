# Bialy

**Time series data visualization and analysis tool**

## Purpose

Bialy is a web-based application for analyzing time series metrics with advanced visualization features. It enables users to:

- Upload and visualize CSV time series data (date, numerator, denominator)
- Apply data aggregation (smoothing or grouping by time periods)
- Compare historical periods using shadow overlays
- Set and track goals against actual performance
- Generate forecasts with confidence intervals
- Focus analysis on specific time periods

The tool is designed for data analysts and decision-makers who need to understand trends, patterns, and performance metrics over time.

## Technology Stack

### Frontend Framework
- **React 18** with TypeScript for type-safe component development
- **Vite** for fast development and optimized production builds

### Visualization
- **D3.js** for interactive SVG-based charts with zoom, pan, and hover interactions
- Custom time series chart component with multiple overlay capabilities

### UI & Styling
- **Tailwind CSS** for utility-first styling
- **date-fns** for date manipulation and formatting

### Data Processing
- Client-side CSV parsing with PapaParse
- Time series aggregation (rolling averages, period grouping)
- Statistical forecasting algorithms (linear regression, exponential smoothing)
- Shadow period calculations for year-over-year comparisons

## Project Structure

```
src/
├── components/        # React components
│   ├── TimeSeriesChart.tsx      # Main D3 chart component
│   ├── AggregateControls.tsx    # Data aggregation UI
│   ├── ShadowControls.tsx       # Historical comparison UI
│   ├── GoalControls.tsx         # Goal management UI
│   ├── ForecastControls.tsx     # Forecasting configuration
│   └── FocusPeriodControls.tsx  # Time period selection
├── types/            # TypeScript type definitions
├── utils/            # Business logic and calculations
│   ├── aggregation.ts   # Data smoothing and grouping
│   ├── shadows.ts       # Shadow period calculations
│   ├── goals.ts         # Goal line generation
│   └── forecasting.ts   # Time series forecasting
└── App.tsx           # Main application component
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application runs on `http://localhost:5173` by default.

## Key Features

- **Aggregate**: Smooth data with rolling averages or group by Week/Month/Quarter/Year
- **Shadows**: Overlay historical data for period-over-period comparisons
- **Goals**: Set target values or growth trajectories to track against
- **Forecasts**: Generate predictions with configurable algorithms and confidence intervals
- **Focus Period**: Analyze specific date ranges with comparative statistics
- **Interactive Charts**: Zoom, pan, and hover to explore data in detail
