"""
Forecast API endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import Dict

from ..models import ForecastRequest, ForecastResponse
from ..services import statsforecast_service

router = APIRouter(
    prefix="/api/v1",
    tags=["forecast"]
)


@router.post("/forecast", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest) -> ForecastResponse:
    """
    Generate time series forecast using StatsForecast

    - **data**: List of time series data points (date, value pairs)
    - **horizon**: Number of periods to forecast into the future
    - **model**: Forecasting model to use (auto, arima, ets, theta)
    - **seasonLength**: Optional season length (auto-detected if not provided)
    - **confidenceLevels**: Confidence interval levels (e.g., [90, 95, 99])

    Returns forecast values with confidence intervals and model diagnostics.
    """
    try:
        result = statsforecast_service.generate_forecast(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")


@router.get("/models")
async def list_available_models() -> Dict:
    """
    List available forecasting models

    Returns information about supported models and their characteristics.
    """
    return {
        "models": [
            {
                "id": "auto",
                "name": "Auto (Best)",
                "description": "Automatically selects the best model (currently uses AutoARIMA)",
                "speed": "fast",
                "accuracy": "high"
            },
            {
                "id": "arima",
                "name": "AutoARIMA",
                "description": "Automated ARIMA model selection",
                "speed": "fast",
                "accuracy": "high",
                "best_for": "Linear trends, stationary data"
            },
            {
                "id": "ets",
                "name": "AutoETS",
                "description": "Exponential Smoothing with automated parameter selection",
                "speed": "very fast",
                "accuracy": "high",
                "best_for": "Seasonal patterns, simple trends"
            },
            {
                "id": "theta",
                "name": "AutoTheta",
                "description": "Theta method for forecasting",
                "speed": "very fast",
                "accuracy": "medium-high",
                "best_for": "Simple patterns, quick forecasts"
            }
        ],
        "recommended": "auto or ets for most use cases"
    }
