"""
Anomaly detection API endpoints
"""
from fastapi import APIRouter, HTTPException

from ..models import AnomalyRequest, AnomalyResponse
from ..services import statsforecast_service

router = APIRouter(
    prefix="/api/v1",
    tags=["anomaly"]
)


@router.post("/detect-anomalies", response_model=AnomalyResponse)
async def detect_anomalies(request: AnomalyRequest) -> AnomalyResponse:
    """
    Detect anomalies in time series data using prediction intervals

    **Method**: Generates in-sample forecasts with confidence intervals,
    then flags data points outside the intervals as anomalies.

    - **data**: List of time series data points (minimum 20 points required)
    - **sensitivity**: Anomaly detection sensitivity
      - `low` (90% CI): More lenient, flags only extreme outliers
      - `medium` (95% CI): Balanced approach (recommended)
      - `high` (99% CI): Very strict, flags even minor deviations
    - **seasonLength**: Optional season length (auto-detected if not provided)
    - **showConfidenceBands**: Include confidence bands for all points in response

    Returns detected anomalies with severity classification and expected value ranges.
    """
    try:
        result = statsforecast_service.detect_anomalies(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")
