# Deployment Walkthrough - Step by Step

## Step 1: Deploy Backend to Railway (15-20 minutes)

### Option A: Deploy via Railway Web Interface (Easiest)

1. **Create Railway Account**
   - Go to https://railway.app
   - Click "Login with GitHub"
   - Authorize Railway to access your repositories

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your Bialy repository
   - Railway will scan your repo

3. **Configure Deployment**
   - Railway should auto-detect the Python app
   - **IMPORTANT**: Set the root directory to `backend`
     - Click on the deployment
     - Go to "Settings"
     - Scroll to "Root Directory"
     - Enter: `backend`
     - Click "Save"

4. **Set Environment Variables** (if needed)
   - Go to "Variables" tab
   - Add: `ALLOWED_ORIGINS` = `http://localhost:5173,https://bialy.vercel.app,https://your-vercel-url.vercel.app`
   - Railway will auto-set `PORT` for you

5. **Deploy**
   - Railway will automatically deploy
   - Wait 2-3 minutes for build to complete
   - Watch the deployment logs

6. **Get Your API URL**
   - Once deployed, click "Settings"
   - Find "Public Networking" section
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://bialy-production.up.railway.app`)

7. **Test Your Deployment**
   ```bash
   # Replace with your Railway URL
   curl https://YOUR-RAILWAY-URL.up.railway.app/api/v1/health

   # Should return:
   # {"status":"healthy","service":"bialy-forecast-api","version":"1.0.0"}
   ```

---

### Option B: Deploy via Railway CLI (For Advanced Users)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend
cd backend

# Initialize Railway project
railway init

# Deploy
railway up

# Get the URL
railway domain
```

---

## Step 2: Update Frontend Configuration (2 minutes)

1. **Update .env.production**
   ```bash
   # Edit the file
   nano .env.production

   # Or use VS Code
   code .env.production
   ```

2. **Replace with your Railway URL**
   ```
   VITE_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
   ```

   Example:
   ```
   VITE_API_URL=https://bialy-production.up.railway.app
   ```

3. **Save the file**

4. **Test locally with production API**
   ```bash
   # In your frontend directory
   npm run dev

   # The frontend will now use the Railway API
   # Open browser console and watch for "[Forecast] Attempting API forecast..."
   ```

---

## Step 3: Test the Integration (5-10 minutes)

### Test 1: Health Check
```bash
# Test your deployed API
curl https://YOUR-RAILWAY-URL.up.railway.app/api/v1/health
```

Expected response:
```json
{"status":"healthy","service":"bialy-forecast-api","version":"1.0.0"}
```

### Test 2: Forecast API
```bash
# Test forecast endpoint
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/v1/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"date": "2024-01-01", "value": 100},
      {"date": "2024-01-02", "value": 105},
      {"date": "2024-01-03", "value": 98},
      {"date": "2024-01-04", "value": 110},
      {"date": "2024-01-05", "value": 107},
      {"date": "2024-01-06", "value": 112},
      {"date": "2024-01-07", "value": 109},
      {"date": "2024-01-08", "value": 115},
      {"date": "2024-01-09", "value": 118},
      {"date": "2024-01-10", "value": 113}
    ],
    "horizon": 5,
    "model": "auto",
    "confidenceLevels": [95]
  }'
```

You should see forecast results!

### Test 3: Frontend to Backend
```bash
# Start your frontend
npm run dev

# In browser console, you should see:
# [Forecast] Attempting API forecast...
# [Forecast] API forecast successful (XXXms)
```

---

## Step 4: Integrate into Your Components (1-2 hours)

Now let's add forecasting and anomaly detection to your existing metric components.

### Where to Add (Find Your Metric Component)

Look for files like:
- `src/pages/DashboardPage.tsx`
- `src/components/MetricGrid.tsx`
- `src/components/MetricRow.tsx`
- Or wherever you render individual metrics

### Integration Pattern

```typescript
// 1. Import the new components and utilities
import { ForecastControls } from '../components/ForecastControls';
import { AnomalyControls } from '../components/AnomalyControls';
import { generateForecastWithFallback } from '../utils/forecastWithFallback';
import { detectAnomalies } from '../services/forecastApi';

// 2. Add state for forecast
const [forecastMeta, setForecastMeta] = useState({
  isGenerating: false,
  usingAPI: false,
  modelUsed: undefined as string | undefined,
  computationTime: undefined as number | undefined
});

// 3. Add state for anomaly detection
const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
const [isDetecting, setIsDetecting] = useState(false);

// 4. Add handler for forecast generation
const handleGenerateForecast = async () => {
  setForecastMeta(prev => ({ ...prev, isGenerating: true }));

  const { result, usingAPI, modelUsed, computationTime } =
    await generateForecastWithFallback(metric.series.data, metric.forecast);

  // Update your metric's forecastSnapshot
  // ... your existing forecast update logic

  setForecastMeta({
    isGenerating: false,
    usingAPI,
    modelUsed,
    computationTime
  });
};

// 5. Add handler for anomaly detection
const handleDetectAnomalies = async () => {
  if (!metric.anomalyDetection) return;

  setIsDetecting(true);

  const result = await detectAnomalies(
    metric.series.data,
    metric.anomalyDetection
  );

  setAnomalyResult(result);
  setIsDetecting(false);
};

// 6. Render the controls
<div className="space-y-4">
  {/* Forecast Controls */}
  <ForecastControls
    config={metric.forecast || defaultForecastConfig}
    onChange={(config) => updateMetricForecast(metric.id, config)}
    onRefreshSnapshot={handleGenerateForecast}
    {...forecastMeta}
  />

  {/* Anomaly Controls */}
  <AnomalyControls
    config={metric.anomalyDetection || defaultAnomalyConfig}
    onChange={(config) => updateMetricAnomalyConfig(metric.id, config)}
    onDetect={handleDetectAnomalies}
    isDetecting={isDetecting}
    anomalyCount={anomalyResult?.anomalyCount}
    totalPoints={anomalyResult?.totalPoints}
  />
</div>
```

---

## Step 5: Add Anomaly Visualization to Chart (30 minutes)

### Update TimeSeriesChart.tsx

```typescript
// 1. Add imports
import type { AnomalyResult, AnomalyConfig } from '../types/anomaly';
import {
  renderConfidenceBands,
  renderAnomalyPoints,
  formatAnomalyTooltip
} from '../utils/anomalyVisualization';

// 2. Add props
interface TimeSeriesChartProps {
  // ... existing props
  anomalyResult?: AnomalyResult;
  anomalyConfig?: AnomalyConfig;
}

// 3. In your chart rendering (after rendering the main line):

// Render confidence bands (shaded area)
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

// Render anomaly points (colored circles)
if (anomalyResult?.anomalies && anomalyResult.anomalies.length > 0) {
  renderAnomalyPoints(
    svg,
    anomalyResult.anomalies,
    xScale,
    yScale,
    (anomaly, event) => {
      // Show tooltip - use your existing tooltip system
      const content = formatAnomalyTooltip(anomaly);
      // showTooltip(event, content);
      console.log('Anomaly:', anomaly);
    },
    () => {
      // hideTooltip();
    }
  );
}
```

---

## Step 6: Deploy Frontend (5 minutes)

```bash
# If using Vercel
vercel --prod

# Or push to GitHub and Vercel will auto-deploy
git add .
git commit -m "feat: Add StatsForecast forecasting and anomaly detection"
git push
```

---

## Step 7: Test Everything (10 minutes)

### Checklist:
- [ ] Backend health check works
- [ ] Forecast API endpoint works
- [ ] Anomaly API endpoint works
- [ ] Frontend connects to backend
- [ ] Forecast generation shows "API: AutoETS" badge
- [ ] Anomaly detection finds anomalies
- [ ] Confidence bands render on chart
- [ ] Anomaly points render as red circles
- [ ] Fallback works (try disabling backend)

---

## 🎉 You're Done!

Your users can now:
- ✅ Generate forecasts for any metric
- ✅ See forecast method (API vs client-side)
- ✅ Detect anomalies with 3 sensitivity levels
- ✅ Visualize anomalies on charts
- ✅ View expected ranges and severity

---

## 🐛 Troubleshooting

### Railway deployment failed?
- Check logs in Railway dashboard
- Ensure `backend` is set as root directory
- Verify `requirements.txt` is correct

### CORS errors?
- Check `ALLOWED_ORIGINS` in Railway environment variables
- Add your Vercel URL

### API not connecting?
- Verify `.env.production` has correct Railway URL
- Check browser console for errors
- Test API directly with curl

### Forecast not showing API badge?
- Check browser console for API call logs
- Verify VITE_API_URL is set correctly
- Check Network tab in DevTools

---

## 📞 Need Help?

1. Check Railway logs: Railway Dashboard > Your Project > Logs
2. Check browser console: DevTools > Console
3. Review test results: `backend/TEST_RESULTS.md`
4. Review examples: `INTEGRATION_GUIDE.md`

---

## 🚀 Optional Enhancements

After basic integration works:

1. **Add Persistence** - Save configs to Supabase
2. **Cache Results** - Store anomaly/forecast results
3. **Add Notifications** - Alert on anomalies
4. **Fine-tune Sensitivity** - Based on user feedback
5. **Add More Models** - Explore other StatsForecast models

---

**Ready to deploy? Start with Step 1!** 🎯
