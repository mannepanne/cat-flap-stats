#!/usr/bin/env python3
# ABOUT: Dataset merging script with duplicate detection for GitHub Actions
# ABOUT: Intelligently merges new PDF data with existing master dataset

import pandas as pd
import json
import sys
from datetime import datetime

def create_session_key(df):
    """Create composite key for duplicate detection using date + session + times"""
    return df['date'].astype(str) + '_' + df['session_number'].astype(str) + '_' + df['exit_time'].astype(str) + '_' + df['entry_time'].astype(str)

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
    except FileNotFoundError:
        print('ERROR: No processed_data.csv found')
        sys.exit(1)

    duplicates_count = 0
    unique_count = 0

    if len(master_df) > 0:
        # Create session keys for duplicate detection
        master_df['session_key'] = create_session_key(master_df)
        new_df['session_key'] = create_session_key(new_df)
        
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
                print(f'  - {dup["date"]} session {dup["session_number"]} ({dup["exit_time"]} - {dup["entry_time"]})')
        
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
            dates = pd.to_datetime(final_df['date'])
            f.write(f'Dataset date range: {dates.min().strftime("%Y-%m-%d")} to {dates.max().strftime("%Y-%m-%d")}\n')
    
    print('Dataset merge completed successfully')
    return 0

if __name__ == '__main__':
    main()