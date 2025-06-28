#!/usr/bin/env python3
"""
ABOUT: Rebuild complete JSON dataset from master CSV with analytics
ABOUT: Converts CSV format to structured JSON with report grouping and precomputed analytics
"""

import pandas as pd
import json
from datetime import datetime
from collections import defaultdict
import sys

def csv_to_structured_json(csv_file, output_file):
    """Convert CSV dataset to structured JSON format with report grouping"""
    
    print(f"Loading CSV dataset from {csv_file}...")
    df = pd.read_csv(csv_file)
    
    if len(df) == 0:
        print("CSV dataset is empty - creating empty JSON structure")
        empty_structure = []
        with open(output_file, 'w') as f:
            json.dump(empty_structure, f, indent=2)
        return empty_structure
    
    print(f"Processing {len(df)} sessions from CSV...")
    
    # Group sessions by report
    reports = defaultdict(lambda: {
        'report_info': {},
        'session_data': [],
        'extracted_at': None
    })
    
    # Process each session
    for _, row in df.iterrows():
        filename = row['filename']
        
        # Set report info if not already set
        if not reports[filename]['report_info']:
            reports[filename]['report_info'] = {
                'filename': filename,
                'report_date': row['report_date'],
                'report_date_range': row['report_date_range'],
                'report_year': int(row['report_year']),
                'pet_name': row['pet_name'],
                'age': row['age'],  # Keep as string format "X years, Y months"
                'weight': row['weight']  # Keep as string format "X.Xkg"
            }
            reports[filename]['extracted_at'] = row['extracted_at']
        
        # Create session data
        session = {
            'date_str': row['date_str'],
            'session_number': int(row['session_number']),
            'exit_time': row['exit_time'] if pd.notna(row['exit_time']) else None,
            'entry_time': row['entry_time'] if pd.notna(row['entry_time']) else None,
            'duration': row['duration'],
            'daily_total_visits_PDF': int(row['daily_total_visits_PDF']),
            'daily_total_time_outside_PDF': row['daily_total_time_outside_PDF'],
            'daily_total_visits_calculated': int(row['daily_total_visits_calculated']),
            'daily_total_time_outside_calculated': row['daily_total_time_outside_calculated'],
            'date_full': row['date_full']
        }
        
        reports[filename]['session_data'].append(session)
    
    # Convert to list format (original JSON structure)
    json_data = []
    for filename, report in reports.items():
        json_data.append(report)
    
    # Sort by report date for consistency
    json_data.sort(key=lambda x: x['report_info']['report_date'])
    
    print(f"Created JSON structure with {len(json_data)} reports")
    
    # Save to file
    with open(output_file, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    print(f"JSON dataset saved to {output_file}")
    return json_data

def main():
    """Main function to rebuild JSON dataset from CSV"""
    csv_file = 'master_dataset.csv'
    json_file = 'master_dataset.json'
    
    try:
        print("=== JSON Dataset Rebuild ===")
        print("Converting master CSV to complete JSON structure...")
        
        # Rebuild JSON from CSV
        json_data = csv_to_structured_json(csv_file, json_file)
        
        # Summary statistics
        total_sessions = 0
        for report in json_data:
            total_sessions += len(report['session_data'])
        
        print(f"\nRebuild completed successfully:")
        print(f"- Reports processed: {len(json_data)}")
        print(f"- Total sessions: {total_sessions}")
        
        if json_data:
            # Get date range
            all_dates = []
            for report in json_data:
                for session in report['session_data']:
                    all_dates.append(session['date_full'])
            
            if all_dates:
                print(f"- Date range: {min(all_dates)} to {max(all_dates)}")
        
        return 0
        
    except Exception as e:
        print(f"Error rebuilding JSON dataset: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())