#!/usr/bin/env python3
# ABOUT: Surgical fix for cross-year boundary date assignment in master_dataset
# ABOUT: Fixes December dates that were incorrectly assigned 2025 instead of 2024

import pandas as pd
import json
from datetime import datetime

def fix_cross_year_data():
    """Fix the incorrectly dated December records in master_dataset files"""
    
    print("🔧 Starting surgical fix for cross-year boundary data...")
    
    # Load the master dataset
    df = pd.read_csv('master_dataset.csv')
    original_count = len(df)
    print(f"📊 Loaded {original_count} records from master_dataset.csv")
    
    # Find records that need fixing
    # These are records from the cross-year PDF with incorrect December dates
    affected_records = df[
        (df['filename'] == 'SvenVarysSootyHultbergWong Activity Report 05-01-2025.pdf') &
        (df['date_full'].str.startswith('2025-12-'))
    ]
    
    print(f"🎯 Found {len(affected_records)} records with incorrect December dates")
    
    if len(affected_records) == 0:
        print("✅ No records need fixing - data is already correct!")
        return
    
    # Show what we're about to fix
    print("\n📝 Records to be fixed:")
    for _, record in affected_records.iterrows():
        print(f"   {record['date_str']}: {record['date_full']} → {record['date_full'].replace('2025-12-', '2024-12-')}")
    
    # Apply the fix
    mask = (
        (df['filename'] == 'SvenVarysSootyHultbergWong Activity Report 05-01-2025.pdf') &
        (df['date_full'].str.startswith('2025-12-'))
    )
    
    # Update date_full column
    df.loc[mask, 'date_full'] = df.loc[mask, 'date_full'].str.replace('2025-12-', '2024-12-')
    
    # Update report_date_range to reflect correct year span
    range_mask = df['filename'] == 'SvenVarysSootyHultbergWong Activity Report 05-01-2025.pdf'
    df.loc[range_mask, 'report_date_range'] = '2024-12-30 to 2025-01-05'
    
    print(f"\n✅ Fixed {len(affected_records)} records")
    
    # Sort by date_full to ensure proper chronological order
    print("📅 Re-sorting data chronologically...")
    df_sorted = df.sort_values('date_full')
    
    # Verify the fix worked
    december_records = df_sorted[
        (df_sorted['filename'] == 'SvenVarysSootyHultbergWong Activity Report 05-01-2025.pdf') &
        (df_sorted['date_str'].str.contains('Dec'))
    ]
    
    if len(december_records) > 0:
        print("\n🔍 Verification - December dates after fix:")
        for _, record in december_records.iterrows():
            print(f"   {record['date_str']}: {record['date_full']}")
    
    # Save the corrected CSV
    print("\n💾 Saving corrected master_dataset.csv...")
    df_sorted.to_csv('master_dataset.csv', index=False)
    
    # Also update the JSON file
    print("💾 Saving corrected master_dataset.json...")
    df_sorted.to_json('master_dataset.json', orient='records', indent=2)
    
    print(f"\n🎉 Fix complete! Data is now properly chronologically ordered.")
    print(f"   Total records: {len(df_sorted)}")
    print(f"   December 2024 dates are now correctly positioned before January 2025")
    
    # Show a sample of the chronological order around the boundary
    print("\n📋 Sample of chronological order around year boundary:")
    boundary_sample = df_sorted[
        (df_sorted['date_full'] >= '2024-12-28') & 
        (df_sorted['date_full'] <= '2025-01-07')
    ][['filename', 'date_str', 'date_full']].drop_duplicates()
    
    for _, record in boundary_sample.iterrows():
        filename_short = record['filename'].replace('SvenVarysSootyHultbergWong Activity Report ', '').replace('.pdf', '')
        print(f"   {record['date_full']} | {record['date_str']} | {filename_short}")

if __name__ == "__main__":
    fix_cross_year_data()