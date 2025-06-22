#!/usr/bin/env python3
# ABOUT: Dataset merging script with duplicate detection for GitHub Actions
# ABOUT: Intelligently merges new PDF data with existing master dataset

import pandas as pd
import json
import sys
import os
from datetime import datetime

def create_session_key(df):
    """Create composite key for duplicate detection using date + session + times"""
    # Find the date column (might be named differently)
    date_col = None
    for col in ['date_full', 'date', 'Date', 'DATE', 'day', 'Day', 'date_str']:
        if col in df.columns:
            date_col = col
            break
    
    if date_col is None:
        print(f"Available columns: {list(df.columns)}")
        raise KeyError("No date column found in dataset")
    
    # Find other required columns
    session_col = None
    for col in ['session_number', 'session', 'Session', 'session_num']:
        if col in df.columns:
            session_col = col
            break
    
    exit_col = None
    for col in ['exit_time', 'Exit_Time', 'exit', 'Exit']:
        if col in df.columns:
            exit_col = col
            break
    
    entry_col = None
    for col in ['entry_time', 'Entry_Time', 'entry', 'Entry']:
        if col in df.columns:
            entry_col = col
            break
    
    print(f"Using columns: date='{date_col}', session='{session_col}', exit='{exit_col}', entry='{entry_col}'")
    
    return df[date_col].astype(str) + '_' + df[session_col].astype(str) + '_' + df[exit_col].astype(str) + '_' + df[entry_col].astype(str)

def main():
    print('=== Dataset Merge with Duplicate Detection ===')
    print('Loading datasets for duplicate detection...')

    # Load existing master dataset
    try:
        master_df = pd.read_csv('master_dataset.csv')
        print(f'Master dataset has {len(master_df)} sessions')
    except FileNotFoundError:
        print('No existing master dataset found - will create new one')
        master_df = pd.DataFrame()

    # Load new data
    try:
        new_df = pd.read_csv('processed_data.csv')
        print(f'New data has {len(new_df)} sessions')
        print(f'CSV columns: {list(new_df.columns)}')
        print(f'First few rows:')
        print(new_df.head())
    except FileNotFoundError:
        print('ERROR: No processed_data.csv found')
        sys.exit(1)

    duplicates_count = 0
    unique_count = 0

    if len(master_df) > 0:
        # Create session keys for duplicate detection
        master_df['session_key'] = create_session_key(master_df)
        new_df['session_key'] = create_session_key(new_df)
        
        # Find the date column for reporting
        date_col = None
        for col in ['date_full', 'date', 'Date', 'DATE', 'day', 'Day', 'date_str']:
            if col in new_df.columns:
                date_col = col
                break
        
        # Find duplicates and unique sessions
        duplicates = new_df[new_df['session_key'].isin(master_df['session_key'])]
        unique_new = new_df[~new_df['session_key'].isin(master_df['session_key'])]
        
        duplicates_count = len(duplicates)
        unique_count = len(unique_new)
        
        print(f'Found {duplicates_count} duplicate sessions')
        print(f'Found {unique_count} new unique sessions')
        
        if duplicates_count > 0:
            print('Duplicate sessions found:')
            for _, dup in duplicates.iterrows():
                print(f'  - {dup[date_col]} session {dup["session_number"]} ({dup["exit_time"]} - {dup["entry_time"]})')
        
        # Only append unique new sessions
        if unique_count > 0:
            # Remove the session_key column before saving
            unique_new_clean = unique_new.drop('session_key', axis=1)
            master_clean = master_df.drop('session_key', axis=1)
            
            # Append unique sessions to master dataset
            combined_df = pd.concat([master_clean, unique_new_clean], ignore_index=True)
            combined_df.to_csv('master_dataset.csv', index=False)
            print(f'Updated master dataset now has {len(combined_df)} sessions')
        else:
            print('No new unique sessions to add - master dataset unchanged')
            # Clean and resave master dataset (remove session_key)
            master_df.drop('session_key', axis=1).to_csv('master_dataset.csv', index=False)
    else:
        # Master is empty, just copy new data
        unique_count = len(new_df)
        new_df.to_csv('master_dataset.csv', index=False)
        print(f'Initialized master dataset with {len(new_df)} sessions')

    # Create processing summary report
    with open('duplicate_report.txt', 'w') as f:
        f.write(f'Duplicate Detection Report\n')
        f.write(f'========================\n')
        f.write(f'New sessions processed: {len(new_df)}\n')
        f.write(f'Duplicate sessions found: {duplicates_count}\n')
        f.write(f'Unique new sessions added: {unique_count}\n')
        
        # Get final count
        final_df = pd.read_csv('master_dataset.csv')
        f.write(f'Total sessions in dataset: {len(final_df)}\n')
        
        if len(final_df) > 0:
            # Find the date column
            date_col = None
            for col in ['date_full', 'date', 'Date', 'DATE', 'day', 'Day', 'date_str']:
                if col in final_df.columns:
                    date_col = col
                    break
            
            if date_col:
                try:
                    dates = pd.to_datetime(final_df[date_col])
                    f.write(f'Dataset date range: {dates.min().strftime("%Y-%m-%d")} to {dates.max().strftime("%Y-%m-%d")}\n')
                except Exception as e:
                    f.write(f'Could not determine date range: {e}\n')
            else:
                f.write(f'Available columns: {list(final_df.columns)}\n')
    
    # Handle JSON dataset merging
    print('Processing JSON dataset...')
    try:
        new_json = None
        with open('processed_data.json', 'r') as f:
            new_json = json.load(f)
        
        if os.path.exists('master_dataset.json'):
            print('Merging with existing JSON dataset')
            with open('master_dataset.json', 'r') as f:
                existing_json = json.load(f)
            
            # Simple merge - append new sessions to existing
            if 'sessions' in existing_json and 'sessions' in new_json:
                existing_json['sessions'].extend(new_json['sessions'])
                existing_json['metadata']['total_sessions'] = len(existing_json['sessions'])
                existing_json['metadata']['last_updated'] = new_json['metadata'].get('generated_at', datetime.now().isoformat())
            else:
                # If structure is different, replace entirely
                existing_json = new_json
            
            # Write merged JSON dataset
            with open('master_dataset.json', 'w') as f:
                json.dump(existing_json, f, indent=2)
        else:
            print('Initializing master JSON dataset')
            with open('master_dataset.json', 'w') as f:
                json.dump(new_json, f, indent=2)
        
        print('JSON dataset processed successfully')
        
    except Exception as e:
        print(f'Warning: JSON processing failed: {e}')
        print('Continuing with CSV-only processing')
    
    print('Dataset merge completed successfully')
    return 0

if __name__ == '__main__':
    main()