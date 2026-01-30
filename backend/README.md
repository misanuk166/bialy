# Bialy Backend API

FastAPI backend for time series forecasting and anomaly detection using StatsForecast.

## Features

- **Forecasting**: Generate forecasts using AutoETS, AutoARIMA, and AutoTheta
- **Anomaly Detection**: Detect anomalies using prediction intervals (90%, 95%, 99%)
- **Fast**: Powered by StatsForecast (20-500x faster than alternatives)
- **FREE**: Deploy on Railway free tier

## Setup

### Local Development

1. Install Python 3.11+
2. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. Visit http://localhost:8000/docs for API documentation

### Deployment (Railway)

1. Push to Git repository
2. Connect Railway to your repo
3. Railway will auto-detect and deploy
4. Get deployment URL and update frontend `.env.production`

## API Endpoints

### POST /api/v1/forecast
Generate time series forecast

**Request:**
```json
{
  "data": [{"date": "2024-01-01", "value": 100}, ...],
  "horizon": 30,
  "model": "auto",
  "seasonLength": 7,
  "confidenceLevels": [95, 99]
}
```

**Response:**
```json
{
  "forecast": [{"date": "2024-02-01", "value": 105.2}, ...],
  "confidenceIntervals": {
    "upper_95": [...],
    "lower_95": [...],
    "upper_99": [...],
    "lower_99": [...]
  },
  "modelUsed": "AutoETS",
  "metrics": {"aic": 1234.5, "computation_time_ms": 45}
}
```

### POST /api/v1/detect-anomalies
Detect anomalies in time series data

**Request:**
```json
{
  "data": [{"date": "2024-01-01", "value": 100}, ...],
  "sensitivity": "medium",
  "seasonLength": 7
}
```

**Response:**
```json
{
  "anomalies": [
    {
      "date": "2024-01-15",
      "value": 150,
      "severity": "high",
      "expectedRange": {"lower": 95, "upper": 105}
    }
  ],
  "totalPoints": 365,
  "anomalyCount": 12,
  "anomalyRate": 0.033
}
```

### GET /api/v1/health
Health check endpoint

## Environment Variables

- `PORT`: Server port (default: 8000)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

## Tech Stack

- **FastAPI**: Modern Python web framework
- **StatsForecast**: Lightning-fast forecasting library by Nixtla
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation
