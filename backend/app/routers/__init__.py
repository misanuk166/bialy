"""
API routers
"""
from .forecast import router as forecast_router
from .anomaly import router as anomaly_router

__all__ = ['forecast_router', 'anomaly_router']
