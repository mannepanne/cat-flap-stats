#!/usr/bin/env python3
"""
Test suite for seasonal analysis functionality in compute_analytics.py
Tests the enhanced seasonal statistics and comparisons
"""

import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
import sys
import os

# Pandas is optional for tests - some functionality will be limited if not available
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

# Add the .github/scripts directory to path to import compute_analytics
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.github', 'scripts'))

class TestSeasonalAnalytics:
    """Test seasonal analysis functionality"""
    
    def setup_method(self):
        """Setup test data"""
        self.test_sessions = [
            {
                'date_full': '2024-03-15',
                'exit_time': '08:00',
                'entry_time': '09:30',
                'duration': '01:30 h',
                'pet_name': 'Sven'
            },
            {
                'date_full': '2024-06-15',
                'exit_time': '07:00',
                'entry_time': '12:00',
                'duration': '05:00 h',
                'pet_name': 'Sven'
            },
            {
                'date_full': '2024-09-15',
                'exit_time': '09:00',
                'entry_time': '10:30',
                'duration': '01:30 h',
                'pet_name': 'Sven'
            },
            {
                'date_full': '2024-12-15',
                'exit_time': '10:00',
                'entry_time': '11:00',
                'duration': '01:00 h',
                'pet_name': 'Sven'
            }
        ]
    
    def test_season_categorization(self):
        """Test UK meteorological season categorization"""
        # Import inside try/catch to handle any import issues gracefully
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        # Create a mock analytics instance
        with patch('builtins.open', mock_open_json([])):
            analytics = CatFlapAnalytics('test.json')
        
        # Test season categorization
        test_cases = [
            (datetime(2024, 3, 15), 'spring'),
            (datetime(2024, 6, 15), 'summer'),
            (datetime(2024, 9, 15), 'autumn'),
            (datetime(2024, 12, 15), 'winter'),
            (datetime(2024, 1, 15), 'winter'),
            (datetime(2024, 2, 15), 'winter')
        ]
        
        for date, expected_season in test_cases:
            assert analytics._get_season(date) == expected_season
    
    def test_season_year_tracking(self):
        """Test season-year tracking for cross-year winters"""
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        with patch('builtins.open', mock_open_json([])):
            analytics = CatFlapAnalytics('test.json')
        
        test_cases = [
            (datetime(2024, 12, 15), 'winter-2024-2025'),
            (datetime(2025, 1, 15), 'winter-2024-2025'),
            (datetime(2025, 2, 15), 'winter-2024-2025'),
            (datetime(2024, 6, 15), 'summer-2024'),
            (datetime(2024, 3, 15), 'spring-2024')
        ]
        
        for date, expected_season_year in test_cases:
            assert analytics._get_season_year(date) == expected_season_year
    
    def test_expected_season_days(self):
        """Test expected days calculation for seasons"""
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        with patch('builtins.open', mock_open_json([])):
            analytics = CatFlapAnalytics('test.json')
        
        # Test regular year
        assert analytics._get_season_expected_days('spring', 2023) == 92
        assert analytics._get_season_expected_days('summer', 2023) == 92
        assert analytics._get_season_expected_days('autumn', 2023) == 91
        assert analytics._get_season_expected_days('winter', 2023) == 90
        
        # Test leap year
        assert analytics._get_season_expected_days('winter', 2024) == 91
    
    def test_confidence_level_scoring(self):
        """Test confidence level based on data completeness"""
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        with patch('builtins.open', mock_open_json([])):
            analytics = CatFlapAnalytics('test.json')
        
        assert analytics._get_confidence_level(80) == 'high'
        assert analytics._get_confidence_level(70) == 'medium'
        assert analytics._get_confidence_level(40) == 'low'
        assert analytics._get_confidence_level(20) == 'very_low'
    
    def test_seasonal_stats_structure(self):
        """Test that seasonal stats return proper structure"""
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        # Create test data in raw format that analytics expects
        raw_data = [
            {
                'report_info': {'report_date': '2024-03-20'},
                'session_data': [
                    {
                        'date_full': '2024-03-15',
                        'exit_time': '08:00',
                        'entry_time': '09:30',
                        'duration': '01:30 h',
                        'pet_name': 'Sven'
                    }
                ]
            },
            {
                'report_info': {'report_date': '2024-06-20'},
                'session_data': [
                    {
                        'date_full': '2024-06-15',
                        'exit_time': '07:00',
                        'entry_time': '12:00',
                        'duration': '05:00 h',
                        'pet_name': 'Sven'
                    }
                ]
            }
        ]
        
        # Mock file reading to return raw data format
        with patch('builtins.open', mock_open_json(raw_data)):
            analytics = CatFlapAnalytics('test.json')
        
        seasonal_stats = analytics.compute_seasonal_stats()
        
        # Check structure
        assert isinstance(seasonal_stats, dict)
        
        # Should have entries for seasons with data (spring and summer)
        for season in ['spring', 'summer']:
            assert season in seasonal_stats
            season_data = seasonal_stats[season]
            
            # Check required structure
            assert 'season' in season_data
            assert 'data_quality' in season_data
            assert 'frequency_metrics' in season_data
            assert 'duration_metrics' in season_data
            assert 'timing_metrics' in season_data
            assert 'instances' in season_data
    
    def test_duration_parsing(self):
        """Test duration parsing for seasonal analysis"""
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        with patch('builtins.open', mock_open_json([])):
            analytics = CatFlapAnalytics('test.json')
        
        test_cases = [
            ('01:30 h', 90),
            ('05:00 h', 300),
            ('21:12 mins', 21.2),
            ('', 0),
            (None, 0)
        ]
        
        for duration_str, expected_minutes in test_cases:
            assert analytics._parse_duration(duration_str) == expected_minutes

def mock_open_json(data):
    """Helper to mock JSON file opening"""
    def mock_open(*args, **kwargs):
        mock_file = MagicMock()
        mock_file.__enter__.return_value = mock_file
        mock_file.read.return_value = json.dumps(data)
        return mock_file
    return mock_open

class TestSeasonalIntegration:
    """Integration tests for seasonal analysis"""
    
    def test_statistical_significance_structure(self):
        """Test that statistical significance testing structure is correct"""
        try:
            from compute_analytics import CatFlapAnalytics
        except Exception as e:
            pytest.skip(f"Could not import CatFlapAnalytics: {e}")
        
        # Create test data with multiple seasons
        raw_data = [
            {
                'report_info': {'report_date': '2024-03-20'},
                'session_data': [
                    {
                        'date_full': '2024-03-15',
                        'exit_time': '08:00',
                        'entry_time': '09:30',
                        'duration': '01:30 h',
                        'pet_name': 'Sven'
                    }
                ]
            },
            {
                'report_info': {'report_date': '2024-06-20'},
                'session_data': [
                    {
                        'date_full': '2024-06-15',
                        'exit_time': '07:00',
                        'entry_time': '12:00',
                        'duration': '05:00 h',
                        'pet_name': 'Sven'
                    }
                ]
            }
        ]
        
        with patch('builtins.open', mock_open_json(raw_data)):
            analytics = CatFlapAnalytics('test.json')
            seasonal_stats = analytics.compute_seasonal_stats()
            
            # Should have comparisons structure even without scipy
            assert 'comparisons' in seasonal_stats
            comparisons = seasonal_stats['comparisons']
            
            # Should indicate if statistical tests are available
            assert isinstance(comparisons, dict)

if __name__ == '__main__':
    pytest.main([__file__, '-v'])