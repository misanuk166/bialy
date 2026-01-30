"""
Bialy Backend API - FastAPI application entry point

Time series forecasting and anomaly detection powered by StatsForecast
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routers import forecast_router, anomaly_router

# Create FastAPI app
app = FastAPI(
    title="Bialy Forecast API",
    description="Time series forecasting and anomaly detection using StatsForecast",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://bialy.vercel.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(forecast_router)
app.include_router(anomaly_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Bialy Forecast API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "forecast": "/api/v1/forecast",
            "anomaly_detection": "/api/v1/detect-anomalies",
            "models": "/api/v1/models",
            "health": "/api/v1/health"
        }
    }


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "bialy-forecast-api",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True  # Enable auto-reload in development
    )
