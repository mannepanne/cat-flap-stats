#!/usr/bin/env python3
# ABOUT: Enhanced cat flap data extractor for SURE Petcare activity reports  
# ABOUT: Extracts individual entry/exit sessions with detailed timing data

import os
import re
import json
import argparse
import pandas as pd
import pdfplumber
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class CatFlapSessionExtractor:
    """Extract detailed cat flap session data from SURE Petcare PDF reports"""
    
    def __init__(self):
        self.extracted_data = []
        self.errors = []
        self.warnings = []
    
    def extract_report_info(self, pdf_path: str) -> Dict:
        """Extract basic report information from PDF"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                first_page = pdf.pages[0]
                text = first_page.extract_text()
                
                info = {
                    'filename': os.path.basename(pdf_path),
                    'report_date': None,
                    'pet_name': None,
                    'age': None,
                    'weight': None
                }
                
                # Extract report date
                lines = text.strip().split('\n')
                for line in lines[:10]:
                    if re.match(r'\d{1,2}\s+\w+\s+\d{4}', line.strip()):
                        info['report_date'] = line.strip()
                        break
                
                # Extract pet info
                for line in lines:
                    if 'PET NAME' in line:
                        match = re.search(r'PET NAME\s+([^C]+?)(?:\s+CONDITIONS|$)', line)
                        if match:
                            info['pet_name'] = match.group(1).strip()
                    
                    if 'AGE' in line:
                        match = re.search(r'AGE\s+(\d+)\s*years?', line)
                        if match:
                            info['age'] = int(match.group(1))
                    
                    if 'WEIGHT' in line:
                        match = re.search(r'WEIGHT\s+(\d+)\s*kg', line)
                        if match:
                            info['weight'] = int(match.group(1))
                
                return info
                
        except Exception as e:
            self.errors.append(f"Error extracting report info from {pdf_path}: {e}")
            return {'filename': os.path.basename(pdf_path)}
    
    def parse_time_range(self, time_str: str) -> Tuple[Optional[str], Optional[str]]:
        """Parse time range string like '05:07 - 06:23' or single time '03:04'"""
        if not time_str or time_str.strip() == '':
            return None, None
        
        time_str = time_str.strip()
        
        # Handle range format "HH:MM - HH:MM"
        if ' - ' in time_str:
            parts = time_str.split(' - ')
            if len(parts) == 2:
                exit_time = parts[0].strip()
                entry_time = parts[1].strip()
                return exit_time, entry_time
        
        # Handle single time (exit only, still outside)
        time_pattern = r'^\d{2}:\d{2}$'
        if re.match(time_pattern, time_str):
            return time_str, None
        
        return None, None
    
    def parse_duration(self, duration_str: str) -> Optional[str]:
        """Parse duration string and return cleaned version"""
        if not duration_str or duration_str.strip() == '':
            return None
        return duration_str.strip()
    
    def extract_daily_sessions(self, pdf_path: str) -> List[Dict]:
        """Extract individual session data from the 'Last 7 days' table"""
        all_sessions = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Look for the "Last 7 days" table across pages
                all_table_data = []
                
                for page_num in range(len(pdf.pages)):
                    page = pdf.pages[page_num]
                    text = page.extract_text()
                    
                    # Check if this page contains relevant data
                    if ('Last 7 days' in text or 
                        'Total Entries' in text or 
                        'Time Outside' in text):
                        
                        tables = page.extract_tables()
                        for table in tables:
                            if table and len(table) > 0:
                                all_table_data.extend(table)
                
                if not all_table_data:
                    return []
                
                # Find the date header row
                date_row_idx = None
                for i, row in enumerate(all_table_data):
                    if row and len(row) >= 7 and row[0] and 'Date' in row[0]:
                        date_row_idx = i
                        break
                
                if date_row_idx is None:
                    self.warnings.append(f"No date header found in {pdf_path}")
                    return []
                
                # Extract dates from header
                header_row = all_table_data[date_row_idx]
                dates = []
                for cell in header_row[1:8]:  # Skip first column, take next 7
                    if cell:
                        dates.append(cell.strip())
                
                # Find summary rows for context
                total_entries_row_idx = None
                time_outside_row_idx = None
                
                for i, row in enumerate(all_table_data):
                    if row and row[0]:
                        cell_content = row[0].strip().lower()
                        if 'total entries' in cell_content:
                            total_entries_row_idx = i
                        elif 'time outside' in cell_content:
                            time_outside_row_idx = i
                
                # Extract sessions for each day
                for day_idx, date_str in enumerate(dates):
                    if not date_str:
                        continue
                    
                    col_idx = day_idx + 1  # Skip first column
                    day_sessions = []
                    session_number = 1
                    
                    # Extract daily totals for context
                    daily_visits = None
                    daily_total_time = None
                    
                    if total_entries_row_idx and col_idx < len(all_table_data[total_entries_row_idx]):
                        visit_data = all_table_data[total_entries_row_idx][col_idx]
                        if visit_data:
                            match = re.search(r'(\d+)', visit_data)
                            if match:
                                daily_visits = int(match.group(1))
                    
                    if time_outside_row_idx and col_idx < len(all_table_data[time_outside_row_idx]):
                        daily_total_time = all_table_data[time_outside_row_idx][col_idx]
                        if daily_total_time:
                            daily_total_time = daily_total_time.strip()
                    
                    # Process session rows (every other row starting from date row + 1)
                    session_row_idx = date_row_idx + 1
                    
                    while session_row_idx < len(all_table_data):
                        current_row = all_table_data[session_row_idx]
                        
                        # Skip if we've reached summary rows
                        if (current_row and current_row[0] and 
                            any(keyword in current_row[0].lower() 
                                for keyword in ['total entries', 'time outside'])):
                            break
                        
                        # Check if this row has session data for our day
                        if (current_row and len(current_row) > col_idx and 
                            current_row[col_idx] and current_row[col_idx].strip()):
                            
                            session_data = current_row[col_idx].strip()
                            exit_time, entry_time = self.parse_time_range(session_data)
                            
                            if exit_time:  # Valid session found
                                # Look for duration in next row
                                duration = None
                                if (session_row_idx + 1 < len(all_table_data) and
                                    len(all_table_data[session_row_idx + 1]) > col_idx):
                                    duration_data = all_table_data[session_row_idx + 1][col_idx]
                                    if duration_data:
                                        duration = self.parse_duration(duration_data)
                                
                                # Create session record
                                session = {
                                    'date_str': date_str,
                                    'session_number': session_number,
                                    'exit_time': exit_time,
                                    'entry_time': entry_time,
                                    'duration': duration,
                                    'daily_total_visits': daily_visits,
                                    'daily_total_time_outside': daily_total_time
                                }
                                
                                day_sessions.append(session)
                                session_number += 1
                        
                        session_row_idx += 2  # Skip to next session row (skip duration row)
                    
                    # Add all sessions for this day
                    all_sessions.extend(day_sessions)
                
        except Exception as e:
            self.errors.append(f"Error extracting session data from {pdf_path}: {e}")
        
        return all_sessions
    
    def process_pdf(self, pdf_path: str) -> Optional[Dict]:
        """Process a single PDF file and extract all session data"""
        print(f"Processing: {os.path.basename(pdf_path)}")
        
        # Extract report info
        report_info = self.extract_report_info(pdf_path)
        
        # Extract session data
        session_data = self.extract_daily_sessions(pdf_path)
        
        if not session_data:
            self.warnings.append(f"No session data found in {pdf_path}")
            return None
        
        # Combine report info with session data
        result = {
            'report_info': report_info,
            'session_data': session_data,
            'extracted_at': datetime.now().isoformat()
        }
        
        print(f"  Found {len(session_data)} individual sessions")
        return result
    
    def process_directory(self, directory: str) -> List[Dict]:
        """Process all PDF files in a directory"""
        pdf_dir = Path(directory)
        
        if not pdf_dir.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")
        
        pdf_files = list(pdf_dir.glob("*.pdf"))
        
        if not pdf_files:
            print(f"No PDF files found in {directory}")
            return []
        
        print(f"Found {len(pdf_files)} PDF files to process")
        
        results = []
        for pdf_file in sorted(pdf_files):
            result = self.process_pdf(pdf_file)
            if result:
                results.append(result)
        
        return results
    
    def flatten_data_for_csv(self, results: List[Dict]) -> List[Dict]:
        """Flatten the extracted data for CSV output"""
        flattened = []
        
        for result in results:
            report_info = result['report_info']
            
            for session in result['session_data']:
                flat_record = {
                    'filename': report_info['filename'],
                    'report_date': report_info['report_date'],
                    'pet_name': report_info['pet_name'],
                    'age': report_info['age'],
                    'weight': report_info['weight'],
                    'date_str': session['date_str'],
                    'session_number': session['session_number'],
                    'exit_time': session['exit_time'],
                    'entry_time': session['entry_time'],
                    'duration': session['duration'],
                    'daily_total_visits': session['daily_total_visits'],
                    'daily_total_time_outside': session['daily_total_time_outside'],
                    'extracted_at': result['extracted_at']
                }
                flattened.append(flat_record)
        
        return flattened
    
    def save_to_csv(self, results: List[Dict], output_path: str):
        """Save extracted data to CSV file"""
        flattened_data = self.flatten_data_for_csv(results)
        df = pd.DataFrame(flattened_data)
        df.to_csv(output_path, index=False)
        print(f"Session data saved to CSV: {output_path}")
    
    def save_to_json(self, results: List[Dict], output_path: str):
        """Save extracted data to JSON file"""
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"Session data saved to JSON: {output_path}")
    
    def print_summary(self, results: List[Dict]):
        """Print summary of extraction results"""
        total_sessions = sum(len(r['session_data']) for r in results)
        
        # Calculate some interesting stats
        session_counts_by_day = {}
        for result in results:
            for session in result['session_data']:
                date_str = session['date_str']
                if date_str not in session_counts_by_day:
                    session_counts_by_day[date_str] = 0
                session_counts_by_day[date_str] += 1
        
        print(f"\n=== SESSION EXTRACTION SUMMARY ===")
        print(f"Files processed: {len(results)}")
        print(f"Total individual sessions: {total_sessions}")
        print(f"Days with data: {len(session_counts_by_day)}")
        
        if session_counts_by_day:
            avg_sessions = total_sessions / len(session_counts_by_day)
            max_sessions = max(session_counts_by_day.values())
            print(f"Average sessions per day: {avg_sessions:.1f}")
            print(f"Maximum sessions in one day: {max_sessions}")
        
        if self.warnings:
            print(f"\nWarnings ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  ⚠️  {warning}")
        
        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors:
                print(f"  ❌ {error}")


def main():
    parser = argparse.ArgumentParser(description='Extract detailed cat flap session data from SURE Petcare PDF reports')
    parser.add_argument('input', help='PDF file or directory containing PDF files')
    parser.add_argument('--output', '-o', help='Output file path (without extension)')
    parser.add_argument('--format', '-f', choices=['csv', 'json', 'both'], default='both',
                        help='Output format (default: both)')
    
    args = parser.parse_args()
    
    extractor = CatFlapSessionExtractor()
    
    # Determine if input is file or directory
    input_path = Path(args.input)
    
    if input_path.is_file() and input_path.suffix.lower() == '.pdf':
        # Single file
        result = extractor.process_pdf(input_path)
        results = [result] if result else []
    elif input_path.is_dir():
        # Directory
        results = extractor.process_directory(input_path)
    else:
        print(f"Error: {args.input} is not a valid PDF file or directory")
        return
    
    if not results:
        print("No data extracted")
        return
    
    # Generate output filename if not provided
    if not args.output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"cat_flap_sessions_{timestamp}"
    
    # Save output
    if args.format in ['csv', 'both']:
        extractor.save_to_csv(results, f"{args.output}.csv")
    
    if args.format in ['json', 'both']:
        extractor.save_to_json(results, f"{args.output}.json")
    
    # Print summary
    extractor.print_summary(results)


if __name__ == "__main__":
    main()