# Phase 3: Backend Integration with StatsForecast - Implementation Scope

## Executive Summary

Implementing a Python backend with StatsForecast for production-grade time series forecasting in Bialy. This will provide:
- **20-500x faster** computation than alternatives (Prophet, pmdarima)
- **State-of-the-art accuracy** with classical statistical methods
- **Multiple algorithms**: ARIMA, ETS, Theta, AutoCES, MSTL
- **Probabilistic forecasting**: Uncertainty intervals included
- **Scalable**: Can forecast millions of series

**Estimated Timeline**: 2-3 weeks
**Complexity**: High

---

## Current Architecture Analysis

### Frontend Stack
- React 19.1.1 + TypeScript 5.9.3
- Vite 7.1.7 build system
- D3.js 7.9.0 for visualization
- Client-side only (static hosting)
- Features: Smoothing, Shadows, Goals

### Existing Infrastructure
- **No backend currently**
- **No API infrastructure**
- **No deployment configuration**
- Pure client-side React app

---

## Implementation Breakdown

### 1. Backend API Development (Week 1)

#### 1.1 Tech Stack Selection
**Recommended**: FastAPI (Python)
- Modern, async-first framework
- Auto-generated OpenAPI docs
- Native Pydantic validation
- Excellent performance
- Easy StatsForecast integration

**Alternative**: Flask (simpler, but synchronous)

#### 1.2 Backend File Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── endpoints/
│   │       │   ├── __init__.py
│   │       │   ├── forecast.py      # Forecast endpoints
│   │       │   └── health.py        # Health check
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Environment config
│   │   └── security.py          # Auth (optional for MVP)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── forecast.py          # Pydantic models
│   │   └── series.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── forecasting.py       # StatsForecast logic
│   └── utils/
│       ├── __init__.py
│       └── data_processing.py   # Data validation
├── tests/
│   ├── __init__.py
│   ├── test_forecast.py
│   └── test_api.py
├── requirements.txt
├── pyproject.toml              # Poetry config (optional)
└── README.md
```

#### 1.3 Core Dependencies
```txt
fastapi==0.115.0
uvicorn[standard]==0.32.0
statsforecast==1.7.9
pandas==2.2.0
numpy==1.26.4
pydantic==2.10.0
python-dateutil==2.9.0
redis==5.2.0              # For caching (optional)
```

#### 1.4 API Endpoints Design

**POST /api/v1/forecast**
```typescript
Request:
{
  data: Array<{ date: string, value: number }>,
  horizon: number,          // Number of periods to forecast
  model: 'auto' | 'arima' | 'ets' | 'theta' | 'ces',
  seasonLength?: number,    // Optional: auto-detect if null
  confidenceLevels?: [80, 95]  // Prediction intervals
}

Response:
{
  forecast: Array<{ date: string, value: number }>,
  confidenceIntervals: {
    upper_80: number[],
    lower_80: number[],
    upper_95: number[],
    lower_95: number[]
  },
  modelUsed: string,
  metrics: {
    aic?: number,
    bic?: number,
    mape?: number
  },
  computationTimeMs: number
}
```

**POST /api/v1/forecast/batch** (for future multi-series support)

**GET /api/v1/models** (list available models)

**GET /api/v1/health** (health check)

#### 1.5 StatsForecast Integration
```python
# services/forecasting.py
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA, AutoETS, AutoTheta

def create_forecast(
    data: List[Dict],
    horizon: int,
    model: str = 'auto'
):
    # Convert to pandas DataFrame
    df = prepare_data(data)

    # Select model
    models = {
        'arima': AutoARIMA(),
        'ets': AutoETS(),
        'theta': AutoTheta()
    }

    # Initialize StatsForecast
    sf = StatsForecast(
        models=[models.get(model, AutoETS())],
        freq='D',  # Auto-detect from data
        n_jobs=-1  # Use all CPU cores
    )

    # Generate forecast
    forecast_df = sf.forecast(
        h=horizon,
        level=[80, 95]  # Confidence intervals
    )

    return forecast_df
```

**Estimated Time**: 4-5 days

---

### 2. Frontend Integration (Week 1-2)

#### 2.1 API Client Layer
Create `src/services/forecastApi.ts`:
```typescript
export interface ForecastRequest {
  data: Array<{ date: Date; value: number }>;
  horizon: number;
  model?: 'auto' | 'arima' | 'ets' | 'theta' | 'ces';
  seasonLength?: number;
  confidenceLevels?: number[];
}

export interface ForecastResponse {
  forecast: Array<{ date: string; value: number }>;
  confidenceIntervals: {
    upper_80: number[];
    lower_80: number[];
    upper_95: number[];
    lower_95: number[];
  };
  modelUsed: string;
  metrics: {
    aic?: number;
    bic?: number;
    mape?: number;
  };
  computationTimeMs: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getForecast(
  request: ForecastRequest
): Promise<ForecastResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...request,
      data: request.data.map(d => ({
        date: d.date.toISOString(),
        value: d.value
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`Forecast failed: ${response.statusText}`);
  }

  return response.json();
}
```

#### 2.2 Forecast State Management
Add to `App.tsx`:
```typescript
const [forecastConfig, setForecastConfig] = useState<ForecastConfig>({
  enabled: false,
  horizon: 30,
  model: 'auto',
  showConfidenceIntervals: true
});
const [forecast, setForecast] = useState<ForecastData | null>(null);
const [forecastLoading, setForecastLoading] = useState(false);
```

#### 2.3 UI Components

**New Component**: `src/components/ForecastControls.tsx`
- Enable/disable forecast toggle
- Horizon slider (7, 14, 30, 60, 90 days)
- Model selector dropdown (Auto, ARIMA, ETS, Theta)
- Season length input (optional)
- Confidence interval toggles
- "Generate Forecast" button
- Loading spinner
- Error handling UI
- Display metrics (model used, computation time, MAPE)

**Update**: `src/components/TimeSeriesChart.tsx`
- Render forecast line (dashed, different color)
- Render confidence intervals (shaded areas)
- Extend x-axis to include forecast horizon
- Legend for forecast vs actual

#### 2.4 Environment Configuration
Add `.env`:
```
VITE_API_URL=http://localhost:8000
```

Add `.env.production`:
```
VITE_API_URL=https://api.bialy.app
```

**Estimated Time**: 3-4 days

---

### 3. Deployment & Infrastructure (Week 2-3)

#### 3.1 Backend Deployment Options

**Option A: Railway (Recommended for MVP)**
- Pros: Easy setup, free tier, auto-deploy from Git
- Cons: Can be slow on free tier
- Cost: $0-$5/month for MVP

**Option B: Render**
- Pros: Free tier, good performance
- Cons: Spins down after inactivity (cold starts)
- Cost: $0-$7/month

**Option C: Vercel Serverless Functions**
- Pros: Scales automatically, fast cold starts
- Cons: Python support limited, 10s timeout
- Cost: Free tier available

**Option D: AWS Lambda + API Gateway**
- Pros: True serverless, pay per request
- Cons: More complex setup, cold starts
- Cost: ~$0-10/month for low traffic

**Option E: DigitalOcean App Platform**
- Pros: Reliable, good performance
- Cons: No free tier
- Cost: $5/month minimum

**Recommendation**: Start with **Railway** for quick MVP, migrate to DigitalOcean if needed.

#### 3.2 Deployment Configuration

**Dockerfile** (if using containerized deployment):
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**railway.toml** (for Railway):
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"

[[healthcheck]]
path = "/api/v1/health"
interval = 60
timeout = 10
```

#### 3.3 Frontend Deployment
- Current: Likely static hosting (Vercel/Netlify)
- Update environment variables for production API URL
- Enable CORS on backend for frontend domain

#### 3.4 CORS Configuration
```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev
        "https://bialy.app",      # Production
        "https://www.bialy.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Estimated Time**: 2-3 days

---

### 4. Optimization & Production Readiness (Week 3)

#### 4.1 Caching Layer (Optional but Recommended)
- **Redis** for caching forecast results
- Cache key: hash of (data, horizon, model)
- TTL: 1 hour (configurable)
- Reduces computation for repeated requests

```python
import redis
import hashlib
import json

redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True
)

def cache_forecast(data, horizon, model, result):
    key = generate_cache_key(data, horizon, model)
    redis_client.setex(key, 3600, json.dumps(result))

def get_cached_forecast(data, horizon, model):
    key = generate_cache_key(data, horizon, model)
    cached = redis_client.get(key)
    return json.loads(cached) if cached else None
```

#### 4.2 Error Handling
- Validation errors (insufficient data, invalid dates)
- Computation failures (model doesn't converge)
- Timeout handling (set max computation time)
- Graceful degradation (fallback to simpler models)

#### 4.3 Rate Limiting
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/forecast")
@limiter.limit("10/minute")  # 10 requests per minute
async def forecast_endpoint(...):
    ...
```

#### 4.4 Monitoring
- Health check endpoint
- Logging (structured JSON logs)
- Error tracking (Sentry integration)
- Performance monitoring (response times)

#### 4.5 Testing
- Unit tests for forecasting service
- API integration tests
- End-to-end tests (frontend → backend)
- Load testing (handle 100 concurrent requests)

**Estimated Time**: 3-4 days

---

### 5. Documentation (Week 3)

#### 5.1 API Documentation
- Auto-generated with FastAPI (Swagger UI)
- Available at `/docs`

#### 5.2 User Documentation
- How to use forecasting feature
- Model selection guide
- Interpreting confidence intervals

#### 5.3 Developer Documentation
- Backend setup instructions
- Environment variables
- Deployment guide
- Troubleshooting

**Estimated Time**: 1-2 days

---

## Total Effort Breakdown

| Task | Days | Complexity |
|------|------|------------|
| Backend API Development | 4-5 | High |
| StatsForecast Integration | 2 | Medium |
| Frontend API Client | 2 | Low |
| UI Components | 2 | Medium |
| Backend Deployment | 2-3 | Medium-High |
| Caching & Optimization | 2 | Medium |
| Testing | 2 | Medium |
| Documentation | 1-2 | Low |
| **TOTAL** | **17-20 days** | **High** |

**Calendar Time**: 2.5-3 weeks (accounting for debugging/iteration)

---

## Risks & Mitigations

### Risk 1: Backend Infrastructure Costs
- **Mitigation**: Start with free tiers (Railway, Render)
- **Fallback**: Implement Phase 1 (client-side) as backup

### Risk 2: API Latency (Network Calls)
- **Mitigation**: Implement caching, keep frontend responsive
- **UX**: Show loading states, allow cancellation

### Risk 3: StatsForecast Model Convergence Issues
- **Mitigation**: Model fallback chain (ARIMA → ETS → Simple ES)
- **Validation**: Require minimum data points (50+)

### Risk 4: CORS/Deployment Issues
- **Mitigation**: Test locally first, use proven deployment platforms
- **Documentation**: Clear deployment guides

### Risk 5: Complexity for Single Developer
- **Mitigation**: Start with minimal viable backend
- **Iteration**: Add features incrementally (caching, auth later)

---

## Minimum Viable Phase 3 (MVP Approach)

If you want to **reduce scope** for faster delivery (1-1.5 weeks):

### Keep:
- ✅ FastAPI backend with single `/forecast` endpoint
- ✅ StatsForecast with AutoETS only (simplest, fastest)
- ✅ Basic frontend integration
- ✅ Railway deployment (easiest)

### Skip for Later:
- ❌ Multiple model selection (just use AutoETS)
- ❌ Caching layer (add when needed)
- ❌ Authentication (public API for MVP)
- ❌ Batch forecasting
- ❌ Rate limiting (add if abused)
- ❌ Comprehensive error handling (basic only)

This reduces to **8-10 days** of work.

---

## Decision Points

Before proceeding, you should decide:

1. **Full Phase 3 vs MVP Phase 3?** (3 weeks vs 1.5 weeks)
2. **Deployment platform?** (Railway recommended)
3. **Skip Phase 1/2 entirely?** (No client-side fallback)
4. **Budget for infrastructure?** ($0-5/month for MVP)
5. **Timeline urgency?** (Speed vs completeness)

---

## Recommendation

Given that forecasting is a core feature but you have no backend yet, I recommend:

**Hybrid Approach**:
1. **Implement Phase 1 first** (client-side Holt-Winters) - 3-5 days
   - Immediate value, no infrastructure
   - Works offline, zero cost
   - Good for 80% of use cases

2. **Then implement MVP Phase 3** - 1.5-2 weeks
   - Backend with AutoETS only
   - Simple deployment (Railway)
   - Enhances Phase 1 with better accuracy

This gives you **working forecasting in 3-5 days**, then **production-grade in 2-3 weeks total**.

---

## Next Steps

Would you like to:
1. **Proceed with full Phase 3 implementation?**
2. **Implement MVP Phase 3 (reduced scope)?**
3. **Start with Phase 1 (client-side) first?**
4. **Create a detailed project plan with tasks?**
