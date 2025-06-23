#!/usr/bin/env python3
# Test the long duration fix for Rules 3b and 4b

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from cat_flap_extractor_v5 import ProductionCatFlapExtractor

def test_long_duration_rules():
    """Test the long duration fix for Rules 3b and 4b"""
    
    extractor = ProductionCatFlapExtractor()
    
    print("Testing Long Duration Rules 3b and 4b")
    print("=" * 50)
    
    # Test Case 1: Thu 19 Jun, 05:58, 18:00 h
    result1 = extractor.determine_single_timestamp_type(
        timestamp="05:58", 
        duration_str="18:00 h", 
        date_str="Thu 19 Jun",
        pdf_filename="test.pdf"
    )
    
    print(f"Test 1 - Thu 19 Jun, 05:58, 18:00 h")
    print(f"  Expected: EXIT (05:58 + 18h = ~midnight)")
    print(f"  Actual: {result1.upper()}")
    print(f"  Calculation:")
    print(f"    - Time until midnight: 24:00 - 05:58 = 18:02")
    print(f"    - Duration: 18:00")
    print(f"    - Match within 30min tolerance: ✓")
    print()
    
    # Test Case 2: Fri 20 Jun, 06:06, 17:53 h  
    result2 = extractor.determine_single_timestamp_type(
        timestamp="06:06",
        duration_str="17:53 h",
        date_str="Fri 20 Jun", 
        pdf_filename="test.pdf"
    )
    
    print(f"Test 2 - Fri 20 Jun, 06:06, 17:53 h")
    print(f"  Expected: EXIT (06:06 + 17:53 = ~midnight)")
    print(f"  Actual: {result2.upper()}")
    print(f"  Calculation:")
    print(f"    - Time until midnight: 24:00 - 06:06 = 17:54")
    print(f"    - Duration: 17:53")
    print(f"    - Match within 30min tolerance: ✓")
    print()
    
    # Test Case 3: Long duration ENTRY example (morning with duration = time since midnight)
    result3 = extractor.determine_single_timestamp_type(
        timestamp="06:00",
        duration_str="06:00 h",
        date_str="Test day",
        pdf_filename="test.pdf"
    )
    
    print(f"Test 3 - Test day, 06:00, 06:00 h (should be ENTRY)")
    print(f"  Expected: ENTRY (was outside for 6h since midnight)")
    print(f"  Actual: {result3.upper()}")
    print(f"  Calculation:")
    print(f"    - Time since midnight: 06:00")
    print(f"    - Duration: 06:00")
    print(f"    - Perfect match: ✓")
    print()
    
    # Show confidence issues (detailed reasoning)
    if extractor.confidence_issues:
        print("Confidence Issues (Detailed Reasoning):")
        for issue in extractor.confidence_issues:
            print(f"  - {issue}")
    
    # Summary
    print("\nSummary:")
    print(f"  Test 1 (19 Jun): {'✓ CORRECT' if result1 == 'exit' else '✗ INCORRECT'}")
    print(f"  Test 2 (20 Jun): {'✓ CORRECT' if result2 == 'exit' else '✗ INCORRECT'}")
    print(f"  Test 3 (Entry): {'✓ CORRECT' if result3 == 'entry' else '✗ INCORRECT'}")

if __name__ == "__main__":
    test_long_duration_rules()