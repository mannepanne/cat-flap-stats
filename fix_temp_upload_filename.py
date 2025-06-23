#!/usr/bin/env python3
# ABOUT: Fix temp_upload.pdf filename in master dataset to use original filename
# ABOUT: Replaces all occurrences of temp_upload.pdf with the actual original filename

import pandas as pd
import json
from datetime import datetime

def fix_temp_upload_filename():
    """Fix the temp_upload.pdf filename in master_dataset files"""
    
    original_filename = "SvenVarysSootyHultbergWong Activity Report 22-06-2025.pdf"
    temp_filename = "temp_upload.pdf"
    
    print("🔧 Starting filename fix for temp_upload.pdf records...")
    
    # Load the master dataset
    df = pd.read_csv('master_dataset.csv')
    original_count = len(df)
    print(f"📊 Loaded {original_count} records from master_dataset.csv")
    
    # Find records that need fixing
    affected_records = df[df['filename'] == temp_filename]
    
    print(f"🎯 Found {len(affected_records)} records with temp_upload.pdf filename")
    
    if len(affected_records) == 0:
        print("✅ No records need fixing - data is already correct!")
        return
    
    # Show what we're about to fix
    print(f"\n📝 Records to be fixed:")
    print(f"   Changing filename from: {temp_filename}")
    print(f"   Changing filename to: {original_filename}")
    
    # Show sample of affected records
    print(f"\n📋 Sample of records being updated:")
    for i, (_, record) in enumerate(affected_records.head(3).iterrows()):
        print(f"   {record['date_str']} ({record['date_full']}): {record['session_number']} sessions")
    
    if len(affected_records) > 3:
        print(f"   ... and {len(affected_records) - 3} more records")
    
    # Apply the fix
    print(f"\n🔄 Updating filename in {len(affected_records)} records...")
    df.loc[df['filename'] == temp_filename, 'filename'] = original_filename
    
    print(f"✅ Updated {len(affected_records)} records")
    
    # Verify the fix worked
    remaining_temp_records = df[df['filename'] == temp_filename]
    if len(remaining_temp_records) > 0:
        print(f"⚠️  Warning: {len(remaining_temp_records)} records still have temp filename")
    else:
        print("✅ All temp_upload.pdf filenames have been successfully updated")
    
    # Show updated records
    updated_records = df[df['filename'] == original_filename]
    print(f"\n📊 Now have {len(updated_records)} records with filename: {original_filename}")
    
    # Save the corrected CSV
    print("\n💾 Saving corrected master_dataset.csv...")
    df.to_csv('master_dataset.csv', index=False)
    
    # Also update the JSON file
    print("💾 Saving corrected master_dataset.json...")
    df.to_json('master_dataset.json', orient='records', indent=2)
    
    print(f"\n🎉 Filename fix complete!")
    print(f"   Total records: {len(df)}")
    print(f"   Records updated: {len(affected_records)}")
    print(f"   All temp_upload.pdf filenames replaced with: {original_filename}")
    
    # Show date range of the updated records
    print(f"\n📅 Date range of updated records:")
    updated_records_sorted = updated_records.sort_values('date_full')
    if len(updated_records_sorted) > 0:
        first_date = updated_records_sorted.iloc[0]['date_full']
        last_date = updated_records_sorted.iloc[-1]['date_full']
        print(f"   From: {first_date} to {last_date}")
        print(f"   Report date: {updated_records_sorted.iloc[0]['report_date']}")
        print(f"   Report date range: {updated_records_sorted.iloc[0]['report_date_range']}")

if __name__ == "__main__":
    fix_temp_upload_filename()