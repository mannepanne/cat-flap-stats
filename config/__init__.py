"""
Configuration package for Cat Flap Stats platform.

This package provides centralized configuration management for all components
of the Cat Flap Stats behavioral analytics platform.
"""

from .settings import (
    Settings,
    TimeThresholds,
    ValidationSettings,
    AnalyticsSettings,
    ProcessingSettings,
    DevelopmentSettings,
    ProductionSettings,
    get_settings,
    settings
)

__all__ = [
    'Settings',
    'TimeThresholds',
    'ValidationSettings',
    'AnalyticsSettings',
    'ProcessingSettings',
    'DevelopmentSettings',
    'ProductionSettings',
    'get_settings',
    'settings'
]

__version__ = '1.0.0'