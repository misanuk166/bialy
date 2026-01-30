"""
StatsForecast service for time series forecasting and anomaly detection
"""
import time
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA, AutoETS, AutoTheta

from ..models import (
    DataPoint,
    ForecastRequest,
    ForecastResponse,
    ForecastPoint,
    ForecastMetrics,
    AnomalyRequest,
    AnomalyResponse,
    AnomalyPoint,
    ExpectedRange,
    ConfidenceBand
)
from .data_processing import (
    prepare_dataframe,
    infer_frequency,
    auto_detect_season_length,
    validate_data
)


class StatsForecastService:
    """Service for time series forecasting using StatsForecast"""

    # Sensitivity to confidence level mapping
    SENSITIVITY_MAP = {
        'low': 90,     # 90% confidence interval
        'medium': 95,  # 95% confidence interval
        'high': 99     # 99% confidence interval
    }

    def generate_forecast(self, request: ForecastRequest) -> ForecastResponse:
        """
        Generate forecast using StatsForecast
        """
        start_time = time.time()

        # Validate data
        validate_data(request.data)

        # Prepare data
        df = prepare_dataframe(request.data)
        freq = infer_frequency(df)

        # Determine season length
        season_length = request.seasonLength
        if season_length is None:
            season_length = auto_detect_season_length(df, freq)

        # Select model
        model, model_name = self._select_model(request.model, season_length)

        # Initialize StatsForecast
        sf = StatsForecast(
            models=[model],
            freq=freq,
            n_jobs=1  # Single job to avoid multiprocessing issues in API
        )

        # Fit and forecast
        forecasts_df = sf.forecast(
            df=df,
            h=request.horizon,
            level=request.confidenceLevels
        )

        # Extract forecasts and confidence intervals
        forecast_points, confidence_intervals = self._extract_forecast_data(
            forecasts_df,
            model_name,
            request.confidenceLevels
        )

        # Calculate metrics
        computation_time = (time.time() - start_time) * 1000  # Convert to ms
        metrics = ForecastMetrics(
            aic=None,  # StatsForecast doesn't always expose AIC/BIC
            bic=None,
            mape=None,  # Would need historical validation
            computation_time_ms=computation_time
        )

        return ForecastResponse(
            forecast=forecast_points,
            confidenceIntervals=confidence_intervals,
            modelUsed=model_name,
            metrics=metrics
        )

    def detect_anomalies(self, request: AnomalyRequest) -> AnomalyResponse:
        """
        Detect anomalies using prediction intervals

        Method: Generate in-sample forecasts with prediction intervals,
        then flag points outside the intervals as anomalies
        """
        start_time = time.time()

        # Validate data
        validate_data(request.data)

        # Prepare data
        df = prepare_dataframe(request.data)
        freq = infer_frequency(df)

        # Determine season length
        season_length = request.seasonLength
        if season_length is None:
            season_length = auto_detect_season_length(df, freq)

        # Get confidence level based on sensitivity
        confidence_level = self.SENSITIVITY_MAP[request.sensitivity]

        # Use AutoETS for anomaly detection (fast and robust)
        model = AutoETS(season_length=season_length)
        model_name = 'AutoETS'

        # Initialize StatsForecast
        sf = StatsForecast(
            models=[model],
            freq=freq,
            n_jobs=1
        )

        # Statistical anomaly detection using confidence intervals
        # This is simpler and works well for most cases
        from scipy import stats

        result_df = df.copy()
        values = df['y'].values

        # Use rolling statistics for better local anomaly detection
        window = min(season_length * 2, len(values))
        if window <3:
            window = len(values)

        # Calculate rolling mean and std
        rolling_mean = pd.Series(values).rolling(window=window, center=True, min_periods=1).mean()
        rolling_std = pd.Series(values).rolling(window=window, center=True, min_periods=1).std()

        # Calculate z-score for confidence level
        z_score = stats.norm.ppf((1 + confidence_level / 100) / 2)

        # Create prediction bounds
        result_df[f'{model_name}-lo-{confidence_level}'] = rolling_mean - z_score * rolling_std
        result_df[f'{model_name}-hi-{confidence_level}'] = rolling_mean + z_score * rolling_std

        # Detect anomalies (values outside prediction intervals)
        lower_col = f'{model_name}-lo-{confidence_level}'
        upper_col = f'{model_name}-hi-{confidence_level}'

        anomalies = []
        confidence_bands = []

        for _, row in result_df.iterrows():
            date_str = row['ds'].strftime('%Y-%m-%d')
            actual_value = row['y']

            # Get prediction bounds (might be NaN for first few points)
            lower_bound = row.get(lower_col, np.nan)
            upper_bound = row.get(upper_col, np.nan)

            # Create confidence band
            if not pd.isna(lower_bound) and not pd.isna(upper_bound):
                if request.showConfidenceBands:
                    confidence_bands.append(ConfidenceBand(
                        date=date_str,
                        lower=float(lower_bound),
                        upper=float(upper_bound)
                    ))

                # Check if value is outside bounds (anomaly)
                if actual_value < lower_bound or actual_value > upper_bound:
                    # Calculate deviation in standard deviations
                    range_size = upper_bound - lower_bound
                    mid_point = (upper_bound + lower_bound) / 2
                    deviation = abs(actual_value - mid_point) / (range_size / 2) if range_size > 0 else 0

                    # Determine severity
                    severity = self._determine_severity(deviation, request.sensitivity)

                    anomalies.append(AnomalyPoint(
                        date=date_str,
                        value=float(actual_value),
                        severity=severity,
                        expectedRange=ExpectedRange(
                            lower=float(lower_bound),
                            upper=float(upper_bound)
                        ),
                        deviation=float(deviation)
                    ))

        # Calculate metrics
        total_points = len(result_df)
        anomaly_count = len(anomalies)
        anomaly_rate = anomaly_count / total_points if total_points > 0 else 0
        computation_time = (time.time() - start_time) * 1000

        return AnomalyResponse(
            anomalies=anomalies,
            totalPoints=total_points,
            anomalyCount=anomaly_count,
            anomalyRate=anomaly_rate,
            confidenceBands=confidence_bands if request.showConfidenceBands else None,
            modelUsed=model_name,
            sensitivity=request.sensitivity,
            computationTimeMs=computation_time
        )

    def _select_model(self, model_type: str, season_length: int):
        """Select StatsForecast model based on request"""
        if model_type == 'arima' or model_type == 'auto':
            model = AutoARIMA(season_length=season_length)
            model_name = 'AutoARIMA'
        elif model_type == 'ets':
            model = AutoETS(season_length=season_length)
            model_name = 'AutoETS'
        elif model_type == 'theta':
            model = AutoTheta(season_length=season_length)
            model_name = 'AutoTheta'
        else:
            # Default to AutoETS (fastest and most robust)
            model = AutoETS(season_length=season_length)
            model_name = 'AutoETS'

        return model, model_name

    def _extract_forecast_data(
        self,
        forecasts_df: pd.DataFrame,
        model_name: str,
        confidence_levels: List[int]
    ) -> Tuple[List[ForecastPoint], Dict]:
        """Extract forecast points and confidence intervals from DataFrame"""
        forecast_points = []
        confidence_intervals = {}

        for _, row in forecasts_df.iterrows():
            # Main forecast value
            forecast_value = row[model_name]
            date_str = row['ds'].strftime('%Y-%m-%d')

            forecast_points.append(ForecastPoint(
                date=date_str,
                value=float(forecast_value)
            ))

        # Extract confidence intervals
        for level in confidence_levels:
            upper_col = f'{model_name}-hi-{level}'
            lower_col = f'{model_name}-lo-{level}'

            if upper_col in forecasts_df.columns:
                confidence_intervals[f'upper_{level}'] = forecasts_df[upper_col].tolist()
                confidence_intervals[f'lower_{level}'] = forecasts_df[lower_col].tolist()

        return forecast_points, confidence_intervals

    def _determine_severity(self, deviation: float, sensitivity: str) -> str:
        """Determine anomaly severity based on deviation"""
        # Higher deviation = higher severity
        # Adjust thresholds based on sensitivity

        if sensitivity == 'low':  # 90% CI - more lenient
            if deviation > 3:
                return 'high'
            elif deviation > 2:
                return 'medium'
            else:
                return 'low'
        elif sensitivity == 'medium':  # 95% CI
            if deviation > 2:
                return 'high'
            elif deviation > 1.5:
                return 'medium'
            else:
                return 'low'
        else:  # high sensitivity (99% CI) - very strict
            if deviation > 1.5:
                return 'high'
            elif deviation > 1:
                return 'medium'
            else:
                return 'low'


# Global service instance
statsforecast_service = StatsForecastService()
