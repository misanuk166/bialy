"""
Data processing and validation utilities
"""
import pandas as pd
from datetime import datetime
from typing import List
from ..models import DataPoint


def prepare_dataframe(data: List[DataPoint], unique_id: str = 'series_1') -> pd.DataFrame:
    """
    Convert list of DataPoint to StatsForecast-compatible DataFrame

    StatsForecast requires columns: unique_id, ds (date), y (value)
    """
    df = pd.DataFrame([
        {
            'unique_id': unique_id,
            'ds': pd.to_datetime(point.date),
            'y': point.value
        }
        for point in data
    ])

    # Sort by date
    df = df.sort_values('ds').reset_index(drop=True)

    return df


def infer_frequency(df: pd.DataFrame) -> str:
    """
    Infer the frequency of the time series data

    Returns frequency code for StatsForecast:
    - 'D': Daily
    - 'W': Weekly
    - 'M': Monthly
    - 'Q': Quarterly
    - 'Y': Yearly
    - 'H': Hourly
    """
    if len(df) < 2:
        return 'D'  # Default to daily

    # Calculate time differences
    time_diffs = df['ds'].diff().dropna()
    median_diff = time_diffs.median()

    # Determine frequency based on median difference
    days = median_diff.days
    seconds = median_diff.total_seconds()

    if seconds < 3600:  # Less than 1 hour
        return 'T'  # Minutes
    elif seconds < 86400:  # Less than 1 day
        return 'H'  # Hourly
    elif days <= 1:
        return 'D'  # Daily
    elif days <= 8:
        return 'W'  # Weekly
    elif days <= 32:
        return 'M'  # Monthly
    elif days <= 100:
        return 'Q'  # Quarterly
    else:
        return 'Y'  # Yearly


def auto_detect_season_length(df: pd.DataFrame, freq: str) -> int:
    """
    Auto-detect reasonable season length based on data frequency

    Common season lengths:
    - Daily data: 7 (weekly), 30 (monthly), or 365 (yearly)
    - Weekly data: 52 (yearly)
    - Monthly data: 12 (yearly)
    - Hourly data: 24 (daily) or 168 (weekly)
    """
    freq_to_season = {
        'H': 24,   # Hourly -> daily seasonality
        'D': 7,    # Daily -> weekly seasonality
        'W': 52,   # Weekly -> yearly seasonality
        'M': 12,   # Monthly -> yearly seasonality
        'Q': 4,    # Quarterly -> yearly seasonality
        'Y': 1,    # Yearly -> no seasonality
    }

    return freq_to_season.get(freq, 7)  # Default to 7


def validate_data(data: List[DataPoint]) -> None:
    """
    Validate time series data

    Raises ValueError if data is invalid
    """
    if len(data) < 2:
        raise ValueError("Need at least 2 data points")

    # Check for NaN or infinite values
    import math
    for point in data:
        if not isinstance(point.value, (int, float)):
            raise ValueError(f"Invalid value at {point.date}: {point.value}")
        if math.isnan(point.value) or math.isinf(point.value):
            raise ValueError(f"Invalid value at {point.date}: {point.value}")

    # Check date parsing
    try:
        dates = [pd.to_datetime(point.date) for point in data]
    except Exception as e:
        raise ValueError(f"Invalid date format: {e}")

    # Check for duplicate dates
    if len(dates) != len(set(dates)):
        raise ValueError("Duplicate dates found in data")
