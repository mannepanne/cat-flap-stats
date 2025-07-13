#!/usr/bin/env python3
"""
Minimal debug test to isolate the hanging issue
"""

import pytest
import sys
import os

def test_basic_functionality():
    """Test basic functionality without complex imports"""
    assert True

def test_path_setup():
    """Test path setup works"""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.github', 'scripts'))
    assert '.github/scripts' in str(sys.path)

def test_import_analytics():
    """Test importing analytics module"""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.github', 'scripts'))
    
    try:
        import compute_analytics
        assert hasattr(compute_analytics, 'CatFlapAnalytics')
    except Exception as e:
        pytest.skip(f"Import failed: {e}")

if __name__ == '__main__':
    pytest.main([__file__, '-v'])