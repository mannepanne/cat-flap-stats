#!/usr/bin/env python3
# ABOUT: Comprehensive tests for critical functionality that caused regressions
# ABOUT: Tests cross-year boundaries, sorting, Rules 3b/4b, and output consistency

import pytest
import pandas as pd
import json
import tempfile
import os
from datetime import datetime
from cat_flap_extractor_v5 import ProductionCatFlapExtractor


class TestCrossYearBoundaryDetection:
    """Tests for cross-year boundary detection and handling"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_detect_cross_year_boundary_december_january(self):
        """Test detection of December→January cross-year boundary"""
        date_strings = ["Mon 30 Dec", "Tue 31 Dec", "Wed 1 Jan", "Thu 2 Jan"]
        report_year = 2025
        
        result = self.extractor.detect_cross_year_boundary(date_strings, report_year)
        
        assert result['cross_year_detected'] is True
        assert result['december_year'] == 2024
        assert result['january_year'] == 2025
    
    def test_detect_cross_year_boundary_no_boundary(self):
        """Test detection when no cross-year boundary exists"""
        date_strings = ["Mon 6 Jan", "Tue 7 Jan", "Wed 8 Jan", "Thu 9 Jan"]
        report_year = 2025
        
        result = self.extractor.detect_cross_year_boundary(date_strings, report_year)
        
        assert result['cross_year_detected'] is False
        assert result['all_year'] == 2025
    
    def test_convert_date_str_with_cross_year_context(self):
        """Test date conversion with cross-year context"""
        # December dates should use previous year
        result_dec = self.extractor.convert_date_str_to_full_date("Mon 30 Dec", 2024)
        assert result_dec == "2024-12-30"
        
        # January dates should use report year 
        result_jan = self.extractor.convert_date_str_to_full_date("Wed 1 Jan", 2025)
        assert result_jan == "2025-01-01"


class TestRules3bAnd4bLongDuration:
    """Tests for Rules 3b and 4b long duration logic"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_rule_3b_morning_long_duration_since_midnight(self):
        """Test Rule 3b: Morning timestamp matching time since midnight → ENTRY"""
        # 08:00 + 8h duration = since midnight pattern
        result = self.extractor.determine_single_timestamp_type("08:00", "08:00 h", "Test Day", "test.pdf")
        assert result == "entry"
    
    def test_rule_3b_morning_long_duration_until_midnight(self):
        """Test Rule 3b: Morning timestamp matching time until midnight → EXIT"""  
        # 06:00 + 18h duration = until midnight pattern (6AM + 18h = midnight)
        result = self.extractor.determine_single_timestamp_type("06:00", "18:00 h", "Test Day", "test.pdf")
        assert result == "exit"
    
    def test_rule_4b_afternoon_long_duration_since_midnight(self):
        """Test Rule 4b: Afternoon timestamp matching time since midnight → ENTRY"""
        # 15:00 + 15h duration = since midnight pattern  
        result = self.extractor.determine_single_timestamp_type("15:00", "15:00 h", "Test Day", "test.pdf")
        assert result == "entry"
    
    def test_rule_4b_afternoon_long_duration_until_midnight(self):
        """Test Rule 4b: Afternoon timestamp matching time until midnight → EXIT"""
        # 15:00 + 9h duration = until midnight pattern (3PM + 9h = midnight)
        result = self.extractor.determine_single_timestamp_type("15:00", "09:00 h", "Test Day", "test.pdf")
        assert result == "exit"
    
    def test_long_duration_fallback_rules(self):
        """Test fallback behavior for long durations that don't match patterns"""
        # Morning with non-matching long duration → ENTRY fallback
        result = self.extractor.determine_single_timestamp_type("08:00", "13:00 h", "Test Day", "test.pdf")
        assert result == "entry"
        
        # Afternoon with non-matching long duration → EXIT fallback  
        result = self.extractor.determine_single_timestamp_type("15:00", "13:00 h", "Test Day", "test.pdf")
        assert result == "exit"
    
    def test_mathematical_precision_tolerance(self):
        """Test that 30-minute tolerance works correctly"""
        # Just within tolerance (±30 minutes = ±0.5 hours)
        result = self.extractor.determine_single_timestamp_type("08:00", "07:45 h", "Test Day", "test.pdf")
        assert result == "entry"  # 8h expected, 7.75h actual = 0.25h diff < 0.5h
        
        # Just outside tolerance - 7:20h duration vs 8h expected = 0.67h diff > 0.5h
        # Rule 3: Morning with short duration that doesn't match pattern → EXIT
        result = self.extractor.determine_single_timestamp_type("08:00", "07:20 h", "Test Day", "test.pdf")
        assert result == "exit"  # Morning exit with non-matching short duration


class TestChronologicalSorting:
    """Tests for chronological sorting functionality"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_chronological_sorting_within_year(self):
        """Test sorting of dates within the same year"""
        test_data = [{
            "report_info": {
                "filename": "test.pdf",
                "report_date": "20 Jun 2024", 
                "report_date_range": "2024-06-10 to 2024-06-20",
                "report_year": 2024,
                "pet_name": "TestCat",
                "age": 2,
                "weight": 4
            },
            "session_data": [
                {"date_full": "2024-06-15", "session_number": 1, "date_str": "Sat 15 Jun", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"},
                {"date_full": "2024-06-10", "session_number": 1, "date_str": "Mon 10 Jun", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"},
                {"date_full": "2024-06-20", "session_number": 1, "date_str": "Thu 20 Jun", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"}
            ],
            "extracted_at": "2024-06-23T12:00:00"
        }]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            temp_path = f.name
        
        try:
            self.extractor.save_to_csv(test_data, temp_path)
            df = pd.read_csv(temp_path)
            
            # Verify chronological order
            assert df.iloc[0]['date_full'] == "2024-06-10"
            assert df.iloc[1]['date_full'] == "2024-06-15" 
            assert df.iloc[2]['date_full'] == "2024-06-20"
        finally:
            os.unlink(temp_path)
    
    def test_chronological_sorting_cross_year_boundary(self):
        """Test sorting of dates across year boundaries"""
        test_data = [{
            "report_info": {
                "filename": "test.pdf",
                "report_date": "5 Jan 2025", 
                "report_date_range": "2024-12-30 to 2025-01-05",
                "report_year": 2025,
                "pet_name": "TestCat",
                "age": 2,
                "weight": 4
            },
            "session_data": [
                {"date_full": "2025-01-02", "session_number": 1, "date_str": "Thu 2 Jan", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"},
                {"date_full": "2024-12-30", "session_number": 1, "date_str": "Mon 30 Dec", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"},
                {"date_full": "2025-01-01", "session_number": 1, "date_str": "Wed 1 Jan", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"},
                {"date_full": "2024-12-31", "session_number": 1, "date_str": "Tue 31 Dec", "exit_time": "06:00", "entry_time": "08:00", "duration": "02:00 h", "daily_total_visits_PDF": 1, "daily_total_time_outside_PDF": "02:00 h", "daily_total_visits_calculated": 1, "daily_total_time_outside_calculated": "02:00"}
            ],
            "extracted_at": "2025-01-06T12:00:00"
        }]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            temp_path = f.name
        
        try:
            self.extractor.save_to_csv(test_data, temp_path)
            df = pd.read_csv(temp_path)
            
            # Verify December 2024 comes before January 2025
            assert df.iloc[0]['date_full'] == "2024-12-30"
            assert df.iloc[1]['date_full'] == "2024-12-31"
            assert df.iloc[2]['date_full'] == "2025-01-01"
            assert df.iloc[3]['date_full'] == "2025-01-02"
        finally:
            os.unlink(temp_path)


class TestOutputConsistency:
    """Tests for CSV/JSON output consistency and formatting"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_csv_json_data_consistency(self):
        """Test that CSV and JSON outputs contain the same data"""
        test_results = [{
            "report_info": {
                "filename": "test.pdf",
                "report_date": "15 Jun 2024", 
                "report_date_range": "2024-06-10 to 2024-06-15",
                "report_year": 2024,
                "pet_name": "TestCat",
                "age": 2,
                "weight": 4
            },
            "session_data": [
                {
                    "date_str": "Mon 10 Jun",
                    "date_full": "2024-06-10",
                    "session_number": 1,
                    "exit_time": "06:00",
                    "entry_time": "08:00", 
                    "duration": "02:00 h",
                    "daily_total_visits_PDF": 1,
                    "daily_total_time_outside_PDF": "02:00 h",
                    "daily_total_visits_calculated": 1,
                    "daily_total_time_outside_calculated": "02:00"
                }
            ],
            "extracted_at": "2024-06-23T12:00:00"
        }]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = os.path.join(temp_dir, "test.csv")
            json_path = os.path.join(temp_dir, "test.json")
            
            # Save in both formats
            self.extractor.save_to_csv(test_results, csv_path)
            self.extractor.save_to_json(test_results, json_path)
            
            # Load and compare
            df = pd.read_csv(csv_path)
            with open(json_path, 'r') as f:
                json_data = json.load(f)
            
            # Verify key data matches
            assert len(df) == 1
            assert len(json_data) == 1
            assert df.iloc[0]['date_full'] == json_data[0]['session_data'][0]['date_full']
            assert df.iloc[0]['session_number'] == json_data[0]['session_data'][0]['session_number']


class TestDateParsingEdgeCases:
    """Tests for edge cases in date parsing and validation"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_parse_report_date_formats(self):
        """Test parsing of various report date formats"""
        # Standard format
        result = self.extractor.parse_report_date("15 June 2024")
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15
        
        # Abbreviated month
        result = self.extractor.parse_report_date("15 Jun 2024")
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15
    
    def test_parse_report_date_invalid(self):
        """Test handling of invalid report dates"""
        assert self.extractor.parse_report_date("") is None
        assert self.extractor.parse_report_date("invalid date") is None
        assert self.extractor.parse_report_date(None) is None
    
    def test_convert_date_str_edge_cases(self):
        """Test date string conversion edge cases"""
        # Valid format
        result = self.extractor.convert_date_str_to_full_date("Mon 15 Jun", 2024)
        assert result == "2024-06-15"
        
        # Invalid inputs
        assert self.extractor.convert_date_str_to_full_date("", 2024) is None
        assert self.extractor.convert_date_str_to_full_date("Mon 15 Jun", None) is None
        assert self.extractor.convert_date_str_to_full_date("invalid", 2024) is None


class TestTimestampParsing:
    """Tests for timestamp parsing functionality"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_parse_timestamp_to_minutes(self):
        """Test conversion of timestamps to minutes since midnight"""
        assert self.extractor.parse_timestamp_to_minutes("00:00") == 0
        assert self.extractor.parse_timestamp_to_minutes("06:00") == 360
        assert self.extractor.parse_timestamp_to_minutes("12:00") == 720
        assert self.extractor.parse_timestamp_to_minutes("23:59") == 1439
    
    def test_parse_timestamp_invalid(self):
        """Test handling of invalid timestamps"""
        assert self.extractor.parse_timestamp_to_minutes("") is None
        assert self.extractor.parse_timestamp_to_minutes("invalid") is None
        # Note: The function doesn't validate 24-hour format, so 25:00 returns 1500 minutes
        assert self.extractor.parse_timestamp_to_minutes("25:00") == 1500


class TestDurationParsing:
    """Tests for duration parsing functionality"""
    
    def setup_method(self):
        self.extractor = ProductionCatFlapExtractor()
    
    def test_parse_duration_hours_formats(self):
        """Test parsing of various duration formats"""
        assert self.extractor.parse_duration_hours("02:30 h") == 2.5
        assert self.extractor.parse_duration_hours("01:00 h") == 1.0
        # Test with more precise expectation for 30:15 mins = 30.25 minutes = 0.504166... hours
        result = self.extractor.parse_duration_hours("30:15 mins")
        assert abs(result - 0.5042) < 0.0001  # Within small tolerance
        assert self.extractor.parse_duration_hours("45 s") == 0.0125
    
    def test_convert_duration_to_hhmm(self):
        """Test conversion of durations to HH:MM format"""
        assert self.extractor.convert_duration_to_hhmm("02:30 h") == "02:30"
        assert self.extractor.convert_duration_to_hhmm("01:30 h") == "01:30"
        assert self.extractor.convert_duration_to_hhmm("45:30 mins") == "00:45"