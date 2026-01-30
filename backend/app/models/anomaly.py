"""
Pydantic models for anomaly detection requests and responses
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from .forecast import DataPoint


class AnomalyRequest(BaseModel):
    """Request model for anomaly detection endpoint"""
    data: List[DataPoint] = Field(..., min_length=20, description="Time series data points (minimum 20 required)")
    sensitivity: Literal['low', 'medium', 'high'] = Field(default='medium', description="Anomaly detection sensitivity")
    seasonLength: Optional[int] = Field(default=None, gt=1, description="Season length for model (auto-detected if not provided)")
    showConfidenceBands: bool = Field(default=True, description="Include confidence bands in response")

    class Config:
        json_schema_extra = {
            "example": {
                "data": [
                    {"date": "2024-01-01", "value": 100.5},
                    {"date": "2024-01-02", "value": 102.3},
                    {"date": "2024-01-15", "value": 150.0}  # Anomaly
                ],
                "sensitivity": "medium",
                "seasonLength": 7,
                "showConfidenceBands": True
            }
        }


class ExpectedRange(BaseModel):
    """Expected value range for a data point"""
    lower: float = Field(..., description="Lower bound of expected range")
    upper: float = Field(..., description="Upper bound of expected range")


class AnomalyPoint(BaseModel):
    """Single anomalous data point"""
    date: str = Field(..., description="Date of anomaly")
    value: float = Field(..., description="Actual value")
    severity: Literal['low', 'medium', 'high'] = Field(..., description="Anomaly severity")
    expectedRange: ExpectedRange = Field(..., description="Expected value range")
    deviation: float = Field(..., description="Deviation from expected range (in standard deviations)")


class ConfidenceBand(BaseModel):
    """Confidence band for a single point"""
    date: str
    lower: float
    upper: float


class AnomalyResponse(BaseModel):
    """Response model for anomaly detection endpoint"""
    anomalies: List[AnomalyPoint] = Field(..., description="Detected anomalies")
    totalPoints: int = Field(..., description="Total number of data points analyzed")
    anomalyCount: int = Field(..., description="Number of anomalies detected")
    anomalyRate: float = Field(..., description="Percentage of anomalous points (0-1)")
    confidenceBands: Optional[List[ConfidenceBand]] = Field(default=None, description="Confidence bands for all points")
    modelUsed: str = Field(..., description="Model used for anomaly detection")
    sensitivity: str = Field(..., description="Sensitivity level used")
    computationTimeMs: float = Field(..., description="Computation time in milliseconds")

    class Config:
        json_schema_extra = {
            "example": {
                "anomalies": [
                    {
                        "date": "2024-01-15",
                        "value": 150.0,
                        "severity": "high",
                        "expectedRange": {"lower": 95.0, "upper": 105.0},
                        "deviation": 4.5
                    }
                ],
                "totalPoints": 365,
                "anomalyCount": 12,
                "anomalyRate": 0.033,
                "confidenceBands": [
                    {"date": "2024-01-01", "lower": 95.0, "upper": 105.0},
                    {"date": "2024-01-02", "lower": 96.0, "upper": 106.0}
                ],
                "modelUsed": "AutoETS",
                "sensitivity": "medium",
                "computationTimeMs": 67.8
            }
        }
