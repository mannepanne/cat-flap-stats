#!/usr/bin/env python3
"""
Centralized configuration management for Cat Flap Stats platform.

This module provides a centralized location for all configuration values,
constants, and settings used across the Python components of the system.
"""

import os
from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class TimeThresholds:
    """Time-based thresholds for behavioral analysis and session classification."""
    
    # Morning/afternoon boundary for timestamp classification (hours)
    MORNING_HOUR_THRESHOLD: int = 12
    
    # Short duration threshold for session classification (hours)
    SHORT_DURATION_HOURS: int = 12
    
    # Tolerance for duration-based timestamp matching (hours)
    TOLERANCE_HOURS: float = 0.5
    
    # Late evening threshold for cross-midnight detection (hours)
    LATE_EVENING_HOUR: int = 20
    
    # Early morning threshold for cross-midnight detection (hours)
    EARLY_MORNING_HOUR: int = 8
    
    # Minutes in a day for midnight calculations
    MINUTES_PER_DAY: int = 24 * 60
    
    # Seconds in an hour for conversion
    SECONDS_PER_HOUR: int = 3600


@dataclass
class ValidationSettings:
    """Settings for data validation and quality checks."""
    
    # Significant visit count mismatch threshold
    SIGNIFICANT_MISMATCH_THRESHOLD: int = 2
    
    # Maximum ratio for visit count validation
    MAX_VISIT_COUNT_RATIO: int = 2
    
    # Minor visit count difference threshold
    MINOR_MISMATCH_THRESHOLD: int = 1
    
    # Large gap detection threshold between PDF files (days)
    GAP_DETECTION_DAYS: int = 14


@dataclass
class AnalyticsSettings:
    """Settings for behavioral analytics and pattern detection."""
    
    # Morning activity period definition (hours)
    MORNING_START_HOUR: int = 5
    MORNING_END_HOUR: int = 10
    
    # Evening activity period definition (hours)
    EVENING_START_HOUR: int = 17
    EVENING_END_HOUR: int = 22
    
    # Seasonal month definitions
    SPRING_MONTHS: tuple = (3, 4, 5)
    SUMMER_MONTHS: tuple = (6, 7, 8)
    AUTUMN_MONTHS: tuple = (9, 10, 11)
    WINTER_MONTHS: tuple = (12, 1, 2)
    
    # Significant seasonal variation threshold (hours)
    SEASONAL_VARIATION_THRESHOLD: int = 2


@dataclass
class ProcessingSettings:
    """Settings for PDF processing and file handling."""
    
    # Maximum file size for PDF processing (bytes)
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Processing timeout (seconds)
    PROCESSING_TIMEOUT: int = 300  # 5 minutes
    
    # Backup retention count
    BACKUP_RETENTION_COUNT: int = 3
    
    # Minimum file size validation (bytes)
    MIN_FILE_SIZE: int = 1000  # 1KB
    
    # Test coverage threshold (percentage)
    TEST_COVERAGE_THRESHOLD: int = 25


@dataclass
class DevelopmentSettings(ProcessingSettings):
    """Development-specific settings."""
    
    # Higher file size limit for development
    MAX_FILE_SIZE: int = 20 * 1024 * 1024  # 20MB
    
    # Relaxed test coverage for development
    TEST_COVERAGE_THRESHOLD: int = 20
    
    # More lenient processing timeout
    PROCESSING_TIMEOUT: int = 600  # 10 minutes
    
    # More backups for development
    BACKUP_RETENTION_COUNT: int = 5


@dataclass
class ProductionSettings(ProcessingSettings):
    """Production-specific settings."""
    
    # Stricter file size limit for production
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Higher test coverage requirement
    TEST_COVERAGE_THRESHOLD: int = 25
    
    # Standard processing timeout
    PROCESSING_TIMEOUT: int = 300  # 5 minutes
    
    # Conservative backup retention
    BACKUP_RETENTION_COUNT: int = 3


class Settings:
    """
    Main settings class that provides access to all configuration values.
    
    This class automatically detects the environment and provides appropriate
    settings for development, testing, or production use.
    """
    
    def __init__(self, environment: Optional[str] = None):
        """
        Initialize settings for the specified environment.
        
        Args:
            environment: Environment name ('development', 'production', 'testing')
                        If None, will auto-detect from environment variables
        """
        self.environment = environment or self._detect_environment()
        
        # Core settings that don't change by environment
        self.time_thresholds = TimeThresholds()
        self.validation = ValidationSettings()
        self.analytics = AnalyticsSettings()
        
        # Environment-specific settings
        self.processing = self._get_processing_settings()
    
    def _detect_environment(self) -> str:
        """
        Detect the current environment from environment variables.
        
        Returns:
            Environment name ('development', 'production', 'testing')
        """
        # Check for common CI/CD environment variables
        if os.getenv('GITHUB_ACTIONS'):
            return 'testing'
        
        # Check for development indicators
        if os.getenv('DEVELOPMENT') or os.getenv('DEV'):
            return 'development'
        
        # Check for explicit environment setting
        env = os.getenv('ENVIRONMENT', '').lower()
        if env in ('development', 'dev'):
            return 'development'
        elif env in ('production', 'prod'):
            return 'production'
        elif env in ('testing', 'test'):
            return 'testing'
        
        # Default to production for safety
        return 'production'
    
    def _get_processing_settings(self) -> ProcessingSettings:
        """
        Get processing settings based on current environment.
        
        Returns:
            ProcessingSettings instance for the current environment
        """
        if self.environment == 'development':
            return DevelopmentSettings()
        elif self.environment == 'production':
            return ProductionSettings()
        else:  # testing
            return ProcessingSettings()
    
    def get_config_dict(self) -> Dict[str, Any]:
        """
        Get all configuration as a dictionary for easy access.
        
        Returns:
            Dictionary containing all configuration values
        """
        return {
            'environment': self.environment,
            'time_thresholds': {
                'morning_hour_threshold': self.time_thresholds.MORNING_HOUR_THRESHOLD,
                'short_duration_hours': self.time_thresholds.SHORT_DURATION_HOURS,
                'tolerance_hours': self.time_thresholds.TOLERANCE_HOURS,
                'late_evening_hour': self.time_thresholds.LATE_EVENING_HOUR,
                'early_morning_hour': self.time_thresholds.EARLY_MORNING_HOUR,
                'minutes_per_day': self.time_thresholds.MINUTES_PER_DAY,
                'seconds_per_hour': self.time_thresholds.SECONDS_PER_HOUR,
            },
            'validation': {
                'significant_mismatch_threshold': self.validation.SIGNIFICANT_MISMATCH_THRESHOLD,
                'max_visit_count_ratio': self.validation.MAX_VISIT_COUNT_RATIO,
                'minor_mismatch_threshold': self.validation.MINOR_MISMATCH_THRESHOLD,
                'gap_detection_days': self.validation.GAP_DETECTION_DAYS,
            },
            'analytics': {
                'morning_start_hour': self.analytics.MORNING_START_HOUR,
                'morning_end_hour': self.analytics.MORNING_END_HOUR,
                'evening_start_hour': self.analytics.EVENING_START_HOUR,
                'evening_end_hour': self.analytics.EVENING_END_HOUR,
                'spring_months': self.analytics.SPRING_MONTHS,
                'summer_months': self.analytics.SUMMER_MONTHS,
                'autumn_months': self.analytics.AUTUMN_MONTHS,
                'winter_months': self.analytics.WINTER_MONTHS,
                'seasonal_variation_threshold': self.analytics.SEASONAL_VARIATION_THRESHOLD,
            },
            'processing': {
                'max_file_size': self.processing.MAX_FILE_SIZE,
                'processing_timeout': self.processing.PROCESSING_TIMEOUT,
                'backup_retention_count': self.processing.BACKUP_RETENTION_COUNT,
                'min_file_size': self.processing.MIN_FILE_SIZE,
                'test_coverage_threshold': self.processing.TEST_COVERAGE_THRESHOLD,
            }
        }
    
    def validate_config(self) -> bool:
        """
        Validate that all configuration values are reasonable.
        
        Returns:
            True if configuration is valid, False otherwise
        """
        try:
            # Validate time thresholds
            assert 0 <= self.time_thresholds.MORNING_HOUR_THRESHOLD <= 24
            assert self.time_thresholds.SHORT_DURATION_HOURS > 0
            assert self.time_thresholds.TOLERANCE_HOURS > 0
            assert 0 <= self.time_thresholds.LATE_EVENING_HOUR <= 24
            assert 0 <= self.time_thresholds.EARLY_MORNING_HOUR <= 24
            
            # Validate validation settings
            assert self.validation.SIGNIFICANT_MISMATCH_THRESHOLD > 0
            assert self.validation.MAX_VISIT_COUNT_RATIO > 0
            assert self.validation.MINOR_MISMATCH_THRESHOLD > 0
            assert self.validation.GAP_DETECTION_DAYS > 0
            
            # Validate analytics settings
            assert 0 <= self.analytics.MORNING_START_HOUR <= 24
            assert 0 <= self.analytics.MORNING_END_HOUR <= 24
            assert 0 <= self.analytics.EVENING_START_HOUR <= 24
            assert 0 <= self.analytics.EVENING_END_HOUR <= 24
            assert self.analytics.SEASONAL_VARIATION_THRESHOLD > 0
            
            # Validate processing settings
            assert self.processing.MAX_FILE_SIZE > 0
            assert self.processing.PROCESSING_TIMEOUT > 0
            assert self.processing.BACKUP_RETENTION_COUNT > 0
            assert self.processing.MIN_FILE_SIZE > 0
            assert 0 <= self.processing.TEST_COVERAGE_THRESHOLD <= 100
            
            return True
            
        except AssertionError:
            return False


# Global settings instance
settings = Settings()


def get_settings(environment: Optional[str] = None) -> Settings:
    """
    Get settings instance for the specified environment.
    
    Args:
        environment: Environment name ('development', 'production', 'testing')
                    If None, will use auto-detected environment
    
    Returns:
        Settings instance configured for the specified environment
    """
    if environment:
        return Settings(environment)
    return settings


if __name__ == '__main__':
    """
    Command-line interface for configuration management.
    
    Usage:
        python config/settings.py                    # Show current config
        python config/settings.py --validate        # Validate config
        python config/settings.py --env development # Show development config
    """
    import sys
    import json
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--validate':
            config = Settings()
            if config.validate_config():
                print("✅ Configuration is valid")
                sys.exit(0)
            else:
                print("❌ Configuration validation failed")
                sys.exit(1)
        elif sys.argv[1] == '--env' and len(sys.argv) > 2:
            config = Settings(sys.argv[2])
            print(f"Configuration for {config.environment} environment:")
            print(json.dumps(config.get_config_dict(), indent=2))
        else:
            print("Usage: python config/settings.py [--validate] [--env environment]")
            sys.exit(1)
    else:
        config = Settings()
        print(f"Current configuration (environment: {config.environment}):")
        print(json.dumps(config.get_config_dict(), indent=2))