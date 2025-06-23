#!/usr/bin/env python3
# ABOUT: Test suite for dataset merging script with duplicate detection
# ABOUT: Validates critical data integrity and duplicate detection logic

import pytest
import pandas as pd
import json
import tempfile
import os
import sys
from pathlib import Path
from unittest.mock import patch, mock_open

# Import the module under test
sys.path.append(str(Path(__file__).parent / '.github' / 'scripts'))
from merge_datasets import create_session_key, main


class TestSessionKeyCreation:
    """Unit tests for session key creation logic"""
    
    def test_create_session_key_standard_columns(self):
        """Test session key creation with standard column names"""
        df = pd.DataFrame({
            'date_full': ['2024-02-05', '2024-02-05', '2024-02-06'],
            'session_number': [1, 2, 1],
            'exit_time': ['06:01', '18:12', '05:18'],
            'entry_time': ['07:39', '20:02', '07:38']
        })
        
        keys = create_session_key(df)
        
        expected_keys = [
            '2024-02-05_1_06:01_07:39',
            '2024-02-05_2_18:12_20:02', 
            '2024-02-06_1_05:18_07:38'
        ]
        
        assert list(keys) == expected_keys
    
    def test_create_session_key_alternative_column_names(self):
        """Test session key creation with alternative column naming"""
        df = pd.DataFrame({
            'date': ['2024-02-05', '2024-02-06'],
            'session': [1, 1],
            'exit': ['06:01', '05:18'],
            'entry': ['07:39', '07:38']
        })
        
        keys = create_session_key(df)
        expected_keys = ['2024-02-05_1_06:01_07:39', '2024-02-06_1_05:18_07:38']
        
        assert list(keys) == expected_keys
    
    def test_create_session_key_missing_date_column(self):
        """Test error handling when date column is missing"""
        df = pd.DataFrame({
            'session_number': [1, 2],
            'exit_time': ['06:01', '18:12'],
            'entry_time': ['07:39', '20:02']
        })
        
        with pytest.raises(KeyError, match="No date column found"):
            create_session_key(df)


class TestDuplicateDetection:
    """Integration tests for duplicate detection logic"""
    
    @pytest.fixture
    def sample_master_data(self):
        """Sample master dataset"""
        return pd.DataFrame({
            'filename': ['report1.pdf', 'report1.pdf', 'report2.pdf'],
            'report_date': ['11 Feb 2024', '11 Feb 2024', '18 Feb 2024'],
            'date_full': ['2024-02-05', '2024-02-05', '2024-02-12'],
            'session_number': [1, 2, 1],
            'exit_time': ['06:01', '18:12', '08:00'],
            'entry_time': ['07:39', '20:02', '09:30'],
            'duration': ['01:38 h', '01:49 h', '01:30 h'],
            'daily_total_visits_PDF': [3, 3, 2],
            'daily_total_time_outside_PDF': ['05:28 h', '05:28 h', '03:00 h'],
            'daily_total_visits_calculated': [3, 3, 2],
            'daily_total_time_outside_calculated': ['05:27', '05:27', '03:00'],
            'extracted_at': ['2024-06-22T16:35:34', '2024-06-22T16:35:34', '2024-06-22T17:00:00']
        })
    
    @pytest.fixture
    def sample_new_data_with_duplicates(self):
        """Sample new data containing some duplicates"""
        return pd.DataFrame({
            'filename': ['new_report.pdf', 'new_report.pdf', 'new_report.pdf'],
            'report_date': ['11 Feb 2024', '11 Feb 2024', '11 Feb 2024'],
            'date_full': ['2024-02-05', '2024-02-05', '2024-02-06'],
            'session_number': [1, 2, 1],
            'exit_time': ['06:01', '18:12', '05:18'],  # First two are duplicates
            'entry_time': ['07:39', '20:02', '07:38'],
            'duration': ['01:38 h', '01:49 h', '01:20 h'],
            'daily_total_visits_PDF': [3, 3, 4],
            'daily_total_time_outside_PDF': ['05:28 h', '05:28 h', '04:00 h'],
            'daily_total_visits_calculated': [3, 3, 4],
            'daily_total_time_outside_calculated': ['05:27', '05:27', '04:00'],
            'extracted_at': ['2024-06-23T16:35:34', '2024-06-23T16:35:34', '2024-06-23T16:35:34']
        })
    
    @pytest.fixture
    def sample_new_data_no_duplicates(self):
        """Sample new data with no duplicates"""
        return pd.DataFrame({
            'filename': ['new_report.pdf', 'new_report.pdf'],
            'report_date': ['25 Feb 2024', '25 Feb 2024'],
            'date_full': ['2024-02-19', '2024-02-19'],
            'session_number': [1, 2],
            'exit_time': ['06:30', '19:00'],
            'entry_time': ['08:00', '21:00'],
            'duration': ['01:30 h', '02:00 h'],
            'daily_total_visits_PDF': [2, 2],
            'daily_total_time_outside_PDF': ['03:30 h', '03:30 h'],
            'daily_total_visits_calculated': [2, 2],
            'daily_total_time_outside_calculated': ['03:30', '03:30'],
            'extracted_at': ['2024-06-23T17:00:00', '2024-06-23T17:00:00']
        })
    
    def test_duplicate_detection_logic(self, sample_master_data, sample_new_data_with_duplicates):
        """Test that duplicate detection correctly identifies duplicates"""
        # Create session keys
        master_keys = create_session_key(sample_master_data)
        new_keys = create_session_key(sample_new_data_with_duplicates)
        
        # Find duplicates
        duplicates = sample_new_data_with_duplicates[new_keys.isin(master_keys)]
        unique_new = sample_new_data_with_duplicates[~new_keys.isin(master_keys)]
        
        # Should find 2 duplicates and 1 unique
        assert len(duplicates) == 2
        assert len(unique_new) == 1
        
        # Check that the unique session is the expected one
        assert unique_new.iloc[0]['date_full'] == '2024-02-06'
        assert unique_new.iloc[0]['exit_time'] == '05:18'
    
    def test_no_duplicates_detected(self, sample_master_data, sample_new_data_no_duplicates):
        """Test case where no duplicates should be found"""
        master_keys = create_session_key(sample_master_data)
        new_keys = create_session_key(sample_new_data_no_duplicates)
        
        duplicates = sample_new_data_no_duplicates[new_keys.isin(master_keys)]
        unique_new = sample_new_data_no_duplicates[~new_keys.isin(master_keys)]
        
        assert len(duplicates) == 0
        assert len(unique_new) == 2


class TestMergeDatasetMain:
    """Integration tests for the main merge function"""
    
    def setup_method(self):
        """Set up temporary directory for test files"""
        self.temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        os.chdir(self.temp_dir)
    
    def teardown_method(self):
        """Clean up temporary files"""
        os.chdir(self.original_cwd)
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_main_with_existing_master_and_new_data(self):
        """Test main function with existing master dataset and new data"""
        # Create master dataset
        master_data = pd.DataFrame({
            'filename': ['existing.pdf'],
            'date_full': ['2024-02-05'],
            'session_number': [1],
            'exit_time': ['06:01'],
            'entry_time': ['07:39'],
            'duration': ['01:38 h']
        })
        master_data.to_csv('master_dataset.csv', index=False)
        
        # Create new data (no duplicates)
        new_data = pd.DataFrame({
            'filename': ['new.pdf'],
            'date_full': ['2024-02-06'],
            'session_number': [1],
            'exit_time': ['08:00'],
            'entry_time': ['09:30'],
            'duration': ['01:30 h']
        })
        new_data.to_csv('processed_data.csv', index=False)
        
        # Run main function
        result = main()
        assert result == 0
        
        # Check results
        assert os.path.exists('master_dataset.csv')
        assert os.path.exists('duplicate_report.txt')
        
        # Verify merged data
        merged_df = pd.read_csv('master_dataset.csv')
        assert len(merged_df) == 2  # Original 1 + New 1
        
        # Check duplicate report
        with open('duplicate_report.txt', 'r') as f:
            report = f.read()
            assert 'New sessions processed: 1' in report
            assert 'Duplicate sessions found: 0' in report
            assert 'Unique new sessions added: 1' in report
    
    def test_main_with_duplicates(self):
        """Test main function when duplicates are detected"""
        # Create master dataset
        master_data = pd.DataFrame({
            'filename': ['existing.pdf'],
            'date_full': ['2024-02-05'],
            'session_number': [1],
            'exit_time': ['06:01'],
            'entry_time': ['07:39'],
            'duration': ['01:38 h']
        })
        master_data.to_csv('master_dataset.csv', index=False)
        
        # Create new data with duplicate
        new_data = pd.DataFrame({
            'filename': ['new.pdf', 'new.pdf'],
            'date_full': ['2024-02-05', '2024-02-06'],
            'session_number': [1, 1],
            'exit_time': ['06:01', '08:00'],  # First is duplicate
            'entry_time': ['07:39', '09:30'],  # First is duplicate
            'duration': ['01:38 h', '01:30 h']
        })
        new_data.to_csv('processed_data.csv', index=False)
        
        # Run main function
        result = main()
        assert result == 0
        
        # Verify only unique data was added
        merged_df = pd.read_csv('master_dataset.csv')
        assert len(merged_df) == 2  # Original 1 + New unique 1
        
        # Check duplicate report
        with open('duplicate_report.txt', 'r') as f:
            report = f.read()
            assert 'New sessions processed: 2' in report
            assert 'Duplicate sessions found: 1' in report
            assert 'Unique new sessions added: 1' in report
    
    def test_main_with_empty_new_data(self):
        """Test main function with empty processed data (no cat flap usage)"""
        # Create master dataset
        master_data = pd.DataFrame({
            'filename': ['existing.pdf'],
            'date_full': ['2024-02-05'],
            'session_number': [1],
            'exit_time': ['06:01'],
            'entry_time': ['07:39'],
            'duration': ['01:38 h']
        })
        master_data.to_csv('master_dataset.csv', index=False)
        
        # Create empty new data (headers only)
        empty_data = pd.DataFrame(columns=['filename', 'date_full', 'session_number', 'exit_time', 'entry_time', 'duration'])
        empty_data.to_csv('processed_data.csv', index=False)
        
        # Run main function
        result = main()
        assert result == 0
        
        # Verify master dataset unchanged
        merged_df = pd.read_csv('master_dataset.csv')
        assert len(merged_df) == 1  # No change
        
        # Check duplicate report mentions no data
        with open('duplicate_report.txt', 'r') as f:
            report = f.read()
            assert 'PDF contained no cat flap usage data' in report
            assert 'New sessions processed: 0' in report
    
    def test_main_with_no_existing_master(self):
        """Test main function when no master dataset exists"""
        # Create new data only
        new_data = pd.DataFrame({
            'filename': ['first.pdf'],
            'date_full': ['2024-02-05'],
            'session_number': [1],
            'exit_time': ['06:01'],
            'entry_time': ['07:39'],
            'duration': ['01:38 h']
        })
        new_data.to_csv('processed_data.csv', index=False)
        
        # Run main function
        result = main()
        assert result == 0
        
        # Check that master dataset was created
        assert os.path.exists('master_dataset.csv')
        merged_df = pd.read_csv('master_dataset.csv')
        assert len(merged_df) == 1
        
        # Check duplicate report
        with open('duplicate_report.txt', 'r') as f:
            report = f.read()
            assert 'Unique new sessions added: 1' in report


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def setup_method(self):
        """Set up temporary directory for test files"""
        self.temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        os.chdir(self.temp_dir)
    
    def teardown_method(self):
        """Clean up temporary files"""
        os.chdir(self.original_cwd)
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_missing_processed_data_file(self):
        """Test error handling when processed_data.csv is missing"""
        # Don't create processed_data.csv
        
        # Run main function - should exit with error
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1
    
    def test_json_processing_with_errors(self):
        """Test JSON processing continues even with JSON errors"""
        # Create minimal CSV data
        new_data = pd.DataFrame({
            'filename': ['test.pdf'],
            'date_full': ['2024-02-05'],
            'session_number': [1],
            'exit_time': ['06:01'],
            'entry_time': ['07:39'],
            'duration': ['01:38 h']
        })
        new_data.to_csv('processed_data.csv', index=False)
        
        # Create invalid JSON file
        with open('processed_data.json', 'w') as f:
            f.write('invalid json content')
        
        # Run main function - should complete despite JSON error
        result = main()
        assert result == 0
        
        # CSV processing should still work
        assert os.path.exists('master_dataset.csv')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])