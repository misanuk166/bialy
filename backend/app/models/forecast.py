"""
Pydantic models for forecast requests and responses
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class DataPoint(BaseModel):
    """Single time series data point"""
    date: str = Field(..., description="Date in ISO format (YYYY-MM-DD)")
    value: float = Field(..., description="Numeric value")


class ForecastRequest(BaseModel):
    """Request model for forecast endpoint"""
    data: List[DataPoint] = Field(..., min_length=10, description="Time series data points (minimum 10 required)")
    horizon: int = Field(..., gt=0, le=365, description="Number of periods to forecast (1-365)")
    model: Literal['auto', 'arima', 'ets', 'theta'] = Field(default='auto', description="Forecasting model to use")
    seasonLength: Optional[int] = Field(default=None, gt=1, description="Season length (e.g., 7 for weekly, 12 for monthly)")
    confidenceLevels: List[int] = Field(default=[95], description="Confidence interval levels (e.g., [90, 95, 99])")

    class Config:
        json_schema_extra = {
            "example": {
                "data": [
                    {"date": "2024-01-01", "value": 100.5},
                    {"date": "2024-01-02", "value": 102.3},
                    {"date": "2024-01-03", "value": 98.7}
                ],
                "horizon": 30,
                "model": "auto",
                "seasonLength": 7,
                "confidenceLevels": [95, 99]
            }
        }


class ForecastPoint(BaseModel):
    """Single forecast point"""
    date: str
    value: float


class ConfidenceIntervals(BaseModel):
    """Confidence intervals for forecast"""
    # Dynamic fields based on requested confidence levels
    # e.g., upper_95, lower_95, upper_99, lower_99
    pass

    class Config:
        extra = "allow"  # Allow dynamic fields like upper_95, lower_95, etc.


class ForecastMetrics(BaseModel):
    """Forecast quality metrics"""
    aic: Optional[float] = Field(default=None, description="Akaike Information Criterion")
    bic: Optional[float] = Field(default=None, description="Bayesian Information Criterion")
    mape: Optional[float] = Field(default=None, description="Mean Absolute Percentage Error")
    computation_time_ms: float = Field(..., description="Computation time in milliseconds")


class ForecastResponse(BaseModel):
    """Response model for forecast endpoint"""
    forecast: List[ForecastPoint] = Field(..., description="Forecasted values")
    confidenceIntervals: dict = Field(..., description="Confidence intervals (upper/lower bounds)")
    modelUsed: str = Field(..., description="Model that was used (e.g., 'AutoETS')")
    metrics: ForecastMetrics = Field(..., description="Model performance metrics")

    class Config:
        json_schema_extra = {
            "example": {
                "forecast": [
                    {"date": "2024-02-01", "value": 105.2},
                    {"date": "2024-02-02", "value": 106.8}
                ],
                "confidenceIntervals": {
                    "upper_95": [110.5, 112.3],
                    "lower_95": [99.9, 101.3],
                    "upper_99": [112.8, 114.7],
                    "lower_99": [97.6, 98.9]
                },
                "modelUsed": "AutoETS",
                "metrics": {
                    "aic": 1234.56,
                    "bic": 1245.67,
                    "mape": 5.2,
                    "computation_time_ms": 45.3
                }
            }
        }
