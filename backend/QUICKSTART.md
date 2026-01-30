# Backend Quick Start Guide

## 🚀 Run Locally (5 Minutes)

### Step 1: Install Dependencies
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Start Server
```bash
uvicorn app.main:app --reload --port 8000
```

### Step 3: Test API
Open http://localhost:8000/docs in your browser to see interactive API documentation.

**Or test via curl:**
```bash
# Health check
curl http://localhost:8000/api/v1/health

# Simple forecast test
curl -X POST http://localhost:8000/api/v1/forecast \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
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
  "confidenceLevels": [95, 99]
}
EOF
```

**Test anomaly detection:**
```bash
curl -X POST http://localhost:8000/api/v1/detect-anomalies \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "data": [
    {"date": "2024-01-01", "value": 100},
    {"date": "2024-01-02", "value": 102},
    {"date": "2024-01-03", "value": 98},
    {"date": "2024-01-04", "value": 105},
    {"date": "2024-01-05", "value": 103},
    {"date": "2024-01-06", "value": 107},
    {"date": "2024-01-07", "value": 104},
    {"date": "2024-01-08", "value": 150},
    {"date": "2024-01-09", "value": 109},
    {"date": "2024-01-10", "value": 108},
    {"date": "2024-01-11", "value": 106},
    {"date": "2024-01-12", "value": 110},
    {"date": "2024-01-13", "value": 105},
    {"date": "2024-01-14", "value": 108},
    {"date": "2024-01-15", "value": 107},
    {"date": "2024-01-16", "value": 112},
    {"date": "2024-01-17", "value": 109},
    {"date": "2024-01-18", "value": 111},
    {"date": "2024-01-19", "value": 108},
    {"date": "2024-01-20", "value": 110}
  ],
  "sensitivity": "medium",
  "showConfidenceBands": true
}
EOF
```

## ✅ Expected Response

**Forecast response:**
```json
{
  "forecast": [
    {"date": "2024-01-11", "value": 116.5},
    {"date": "2024-01-12", "value": 118.2},
    ...
  ],
  "confidenceIntervals": {
    "upper_95": [122.3, 125.1, ...],
    "lower_95": [110.7, 111.3, ...],
    "upper_99": [125.8, 128.5, ...],
    "lower_99": [107.2, 107.9, ...]
  },
  "modelUsed": "AutoETS",
  "metrics": {
    "aic": null,
    "bic": null,
    "mape": null,
    "computation_time_ms": 45.3
  }
}
```

**Anomaly response:**
```json
{
  "anomalies": [
    {
      "date": "2024-01-08",
      "value": 150.0,
      "severity": "high",
      "expectedRange": {
        "lower": 95.2,
        "upper": 115.8
      },
      "deviation": 4.5
    }
  ],
  "totalPoints": 20,
  "anomalyCount": 1,
  "anomalyRate": 0.05,
  "modelUsed": "AutoETS",
  "sensitivity": "medium",
  "computationTimeMs": 67.8
}
```

## 🐛 Troubleshooting

**Import errors?**
```bash
# Make sure you're in the venv
which python  # Should show .../venv/bin/python

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

**Port 8000 already in use?**
```bash
# Use a different port
uvicorn app.main:app --reload --port 8001

# Update .env.local to match:
# VITE_API_URL=http://localhost:8001
```

**CORS errors?**
Check that your frontend origin is in ALLOWED_ORIGINS:
```bash
export ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
uvicorn app.main:app --reload
```

## 📖 Next Steps

1. ✅ Backend tested locally → Deploy to Railway
2. See `../STATSFORECAST_IMPLEMENTATION.md` for full deployment guide
