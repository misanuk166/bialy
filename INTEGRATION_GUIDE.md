# Integration Guide: StatsForecast Forecasting & Anomaly Detection

This guide shows how to integrate the StatsForecast backend with your React frontend.

---

## 📋 Quick Start

### 1. Backend is Ready ✅
- All API endpoints tested and working
- See `backend/TEST_RESULTS.md` for test results
- Run locally: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload`

### 2. Frontend Components Ready ✅
- `AnomalyControls.tsx` - UI for anomaly detection
- `ForecastControls.tsx` - Enhanced with API status
- API client with fallback mechanism

---

## 🔌 Integration Example

### Example 1: Forecast Generation with API Fallback

```typescript
import { useState } from 'react';
import { ForecastControls } from './components/ForecastControls';
import { generateForecastWithFallback } from './utils/forecastWithFallback';
import type { ForecastConfig, ForecastResult } from './types/forecast';
import type { TimeSeriesPoint } from './types/series';

function MyMetricComponent() {
  const [forecastConfig, setForecastConfig] = useState<ForecastConfig>({
    enabled: false,
    horizon: 30,
    type: 'auto',
    seasonal: 'additive',
    showConfidenceIntervals: true,
    confidenceLevel: 95
  });

  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usingAPI, setUsingAPI] = useState(false);
  const [modelUsed, setModelUsed] = useState<string>();
  const [computationTime, setComputationTime] = useState<number>();

  const data: TimeSeriesPoint[] = [/* your time series data */];

  const handleGenerateForecast = async () => {
    setIsGenerating(true);

    const {
      result,
      usingAPI: usedAPI,
      modelUsed: model,
      computationTime: time
    } = await generateForecastWithFallback(data, forecastConfig);

    setForecastResult(result);
    setUsingAPI(usedAPI);
    setModelUsed(model);
    setComputationTime(time);
    setIsGenerating(false);
  };

  return (
    <div>
      <ForecastControls
        config={forecastConfig}
        onChange={setForecastConfig}
        onRefreshSnapshot={handleGenerateForecast}
        isGenerating={isGenerating}
        usingAPI={usingAPI}
        modelUsed={modelUsed}
        computationTime={computationTime}
      />

      {/* Render your chart with forecastResult */}
    </div>
  );
}
```

---

### Example 2: Anomaly Detection

```typescript
import { useState } from 'react';
import { AnomalyControls } from './components/AnomalyControls';
import { detectAnomalies } from './services/forecastApi';
import type { AnomalyConfig, AnomalyResult } from './types/anomaly';
import type { TimeSeriesPoint } from './types/series';

function MyMetricComponent() {
  const [anomalyConfig, setAnomalyConfig] = useState<AnomalyConfig>({
    enabled: false,
    sensitivity: 'medium',
    showConfidenceBands: true
  });

  const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const data: TimeSeriesPoint[] = [/* your time series data */];

  const handleDetectAnomalies = async () => {
    setIsDetecting(true);

    const result = await detectAnomalies(data, anomalyConfig);

    if (result) {
      setAnomalyResult(result);
      console.log(`Found ${result.anomalyCount} anomalies (${(result.anomalyRate * 100).toFixed(1)}% of data)`);
    }

    setIsDetecting(false);
  };

  return (
    <div>
      <AnomalyControls
        config={anomalyConfig}
        onChange={setAnomalyConfig}
        onDetect={handleDetectAnomalies}
        isDetecting={isDetecting}
        anomalyCount={anomalyResult?.anomalyCount}
        totalPoints={anomalyResult?.totalPoints}
      />

      {/* Render your chart with anomalyResult */}
    </div>
  );
}
```

---

### Example 3: Combined Forecast + Anomaly Detection

```typescript
import { useState } from 'react';
import { ForecastControls } from './components/ForecastControls';
import { AnomalyControls } from './components/AnomalyControls';
import { generateForecastWithFallback } from './utils/forecastWithFallback';
import { detectAnomalies } from './services/forecastApi';

function MyMetricComponent() {
  // Forecast state
  const [forecastConfig, setForecastConfig] = useState<ForecastConfig>({...});
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [forecastMeta, setForecastMeta] = useState({
    isGenerating: false,
    usingAPI: false,
    modelUsed: undefined as string | undefined,
    computationTime: undefined as number | undefined
  });

  // Anomaly detection state
  const [anomalyConfig, setAnomalyConfig] = useState<AnomalyConfig>({...});
  const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const data: TimeSeriesPoint[] = [/* your data */];

  const handleGenerateForecast = async () => {
    setForecastMeta(prev => ({ ...prev, isGenerating: true }));

    const { result, usingAPI, modelUsed, computationTime } =
      await generateForecastWithFallback(data, forecastConfig);

    setForecastResult(result);
    setForecastMeta({ isGenerating: false, usingAPI, modelUsed, computationTime });
  };

  const handleDetectAnomalies = async () => {
    setIsDetecting(true);
    const result = await detectAnomalies(data, anomalyConfig);
    setAnomalyResult(result);
    setIsDetecting(false);
  };

  return (
    <div className="space-y-4">
      {/* Forecast Controls */}
      <ForecastControls
        config={forecastConfig}
        onChange={setForecastConfig}
        onRefreshSnapshot={handleGenerateForecast}
        {...forecastMeta}
      />

      {/* Anomaly Controls */}
      <AnomalyControls
        config={anomalyConfig}
        onChange={setAnomalyConfig}
        onDetect={handleDetectAnomalies}
        isDetecting={isDetecting}
        anomalyCount={anomalyResult?.anomalyCount}
        totalPoints={anomalyResult?.totalPoints}
      />

      {/* Chart with both forecast and anomalies */}
      <TimeSeriesChart
        series={series}
        forecastConfig={forecastConfig}
        forecastResult={forecastResult}
        anomalyResult={anomalyResult}
        anomalyConfig={anomalyConfig}
      />
    </div>
  );
}
```

---

## 🎨 Chart Visualization

### Adding Anomaly Visualization to TimeSeriesChart

```typescript
// In your TimeSeriesChart.tsx, add these imports:
import { renderConfidenceBands, renderAnomalyPoints, formatAnomalyTooltip } from '../utils/anomalyVisualization';
import type { AnomalyResult, AnomalyConfig } from '../types/anomaly';

// Add to TimeSeriesChartProps:
interface TimeSeriesChartProps {
  // ... existing props
  anomalyResult?: AnomalyResult;
  anomalyConfig?: AnomalyConfig;
}

// In your chart rendering code (after rendering the main line):

// 1. Render confidence bands (shaded area)
if (anomalyConfig?.showConfidenceBands && anomalyResult?.confidenceBands) {
  renderConfidenceBands(
    svg,
    anomalyResult.confidenceBands,
    xScale,
    yScale,
    'red',  // Color
    0.1     // Opacity
  );
}

// 2. Render anomaly points (red circles)
if (anomalyResult?.anomalies && anomalyResult.anomalies.length > 0) {
  renderAnomalyPoints(
    svg,
    anomalyResult.anomalies,
    xScale,
    yScale,
    (anomaly, event) => {
      // Show tooltip on hover
      const tooltipContent = formatAnomalyTooltip(anomaly);
      showTooltip(event, tooltipContent);
    },
    () => {
      // Hide tooltip on mouse leave
      hideTooltip();
    }
  );
}
```

---

## 💾 Persistence (Optional)

### Saving Forecast/Anomaly Settings to Supabase

```typescript
import { supabase } from './lib/supabase';

// Save forecast config
async function saveForecastConfig(metricId: string, config: ForecastConfig) {
  await supabase
    .from('dashboard_settings')
    .upsert({
      user_id: userId,
      dashboard_id: dashboardId,
      setting_id: `metric_${metricId}_forecast_config`,
      setting_value: config
    });
}

// Save anomaly config
async function saveAnomalyConfig(metricId: string, config: AnomalyConfig) {
  await supabase
    .from('dashboard_settings')
    .upsert({
      user_id: userId,
      dashboard_id: dashboardId,
      setting_id: `metric_${metricId}_anomaly_config`,
      setting_value: config
    });
}

// Cache anomaly results (for performance)
async function cacheAnomalyResults(metricId: string, result: AnomalyResult) {
  await supabase
    .from('dashboard_settings')
    .upsert({
      user_id: userId,
      dashboard_id: dashboardId,
      setting_id: `metric_${metricId}_anomaly_results`,
      setting_value: {
        detectedAt: new Date().toISOString(),
        ...result
      }
    });
}
```

---

## 🚀 Deployment Checklist

### Backend
- [ ] Test locally (`cd backend && uvicorn app.main:app --reload`)
- [ ] Deploy to Railway (see `backend/QUICKSTART.md`)
- [ ] Update `.env.production` with Railway URL
- [ ] Test deployed endpoints

### Frontend
- [ ] Update components to use new props (see examples above)
- [ ] Add anomaly visualization to TimeSeriesChart
- [ ] Test with backend running locally
- [ ] Test with deployed backend
- [ ] Deploy frontend to Vercel

### Testing
- [ ] Forecast generation works
- [ ] Anomaly detection works
- [ ] Fallback to client-side works when API is down
- [ ] Confidence bands render correctly
- [ ] Anomaly points render with correct colors
- [ ] Tooltips show anomaly details

---

## 📚 API Reference

### Forecast Endpoint
```typescript
POST /api/v1/forecast
{
  data: Array<{date: string, value: number}>,
  horizon: number,
  model: 'auto' | 'arima' | 'ets' | 'theta',
  confidenceLevels: number[]
}
```

### Anomaly Endpoint
```typescript
POST /api/v1/detect-anomalies
{
  data: Array<{date: string, value: number}>,
  sensitivity: 'low' | 'medium' | 'high',
  showConfidenceBands: boolean
}
```

### Health Check
```typescript
GET /api/v1/health
```

---

## 🐛 Troubleshooting

### API not connecting?
1. Check backend is running: `curl http://localhost:8000/api/v1/health`
2. Check CORS settings in `backend/app/main.py`
3. Check `.env.local` has correct `VITE_API_URL`

### Forecast not generating?
1. Check browser console for errors
2. Verify data has at least 10 points
3. Check API response in Network tab

### Anomalies not detected?
1. Verify data has at least 20 points
2. Try different sensitivity levels
3. Check if anomalies exist in your data

---

## 💡 Tips

1. **Start with API disabled**: Test client-side forecasting first
2. **Use fallback mechanism**: Always use `generateForecastWithFallback`
3. **Cache results**: Save forecast/anomaly snapshots to avoid recomputation
4. **Adjust sensitivity**: Start with 'medium', adjust based on results
5. **Show user feedback**: Use loading states and computation time displays

---

## 🎯 Next Steps

1. Deploy backend to Railway
2. Integrate examples into your metric components
3. Add anomaly visualization to charts
4. Test end-to-end
5. Iterate based on user feedback!
