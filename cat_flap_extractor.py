#!/usr/bin/env python3
# ABOUT: Cat flap data extractor for SURE Petcare activity reports
# ABOUT: Extracts daily entry/exit data from PDF reports and outputs to CSV/JSON

import os
import re
import json
import argparse
import pandas as pd
import pdfplumber
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class CatFlapExtractor:
    """Extract cat flap data from SURE Petcare PDF reports"""
    
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
                
                # Extract report date (line 3 usually contains date like "1 Sep 2024")
                lines = text.strip().split('\n')
                for i, line in enumerate(lines[:10]):
                    if re.match(r'\d{1,2}\s+\w+\s+\d{4}', line.strip()):
                        info['report_date'] = line.strip()
                        break
                
                # Extract pet info
                for line in lines:
                    if 'PET NAME' in line:
                        # Extract pet name (everything after "PET NAME" and before "CONDITIONS")
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
        
        # Handle single time (exit only)
        time_pattern = r'^\d{2}:\d{2}$'
        if re.match(time_pattern, time_str):
            return time_str, None
        
        return None, None
    
    def extract_daily_data(self, pdf_path: str) -> List[Dict]:
        """Extract daily activity data from the 'Last 7 days' table"""
        daily_data = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Look for the "Last 7 days" table on page 2 (and potentially page 3)
                for page_num in range(1, min(len(pdf.pages), 4)):  # Check pages 2-3
                    page = pdf.pages[page_num]
                    text = page.extract_text()
                    
                    if 'Last 7 days' in text:
                        tables = page.extract_tables()
                        
                        for table in tables:
                            if not table or len(table) < 2:
                                continue
                            
                            # Find the date header row
                            date_row = None
                            for i, row in enumerate(table):
                                if row and len(row) >= 7 and row[0] and 'Date' in row[0]:
                                    date_row = i
                                    break
                            
                            if date_row is None:
                                continue
                            
                            # Extract dates from header row
                            header_row = table[date_row]
                            dates = []
                            for cell in header_row[1:8]:  # Skip first column, take next 7
                                if cell:
                                    dates.append(cell.strip())
                            
                            # Find data rows
                            left_entered_row = None
                            duration_row = None
                            total_entries_row = None
                            time_outside_row = None
                            
                            for i, row in enumerate(table[date_row + 1:], date_row + 1):
                                if not row or not row[0]:
                                    continue
                                
                                cell_content = row[0].strip().lower()
                                if 'left' in cell_content and 'entered' in cell_content:
                                    left_entered_row = i
                                elif 'duration' in cell_content:
                                    duration_row = i
                                elif 'total entries' in cell_content:
                                    total_entries_row = i
                                elif 'time outside' in cell_content:
                                    time_outside_row = i
                            
                            # Extract data for each day
                            for day_idx, date_str in enumerate(dates):
                                if not date_str:
                                    continue
                                
                                col_idx = day_idx + 1  # Skip first column
                                
                                # Extract times
                                exit_time, entry_time = None, None
                                if left_entered_row is not None and col_idx < len(table[left_entered_row]):
                                    time_data = table[left_entered_row][col_idx]
                                    if time_data:
                                        exit_time, entry_time = self.parse_time_range(time_data)
                                
                                # Extract duration
                                duration = None
                                if duration_row is not None and col_idx < len(table[duration_row]):
                                    duration = table[duration_row][col_idx]
                                    if duration:
                                        duration = duration.strip()
                                
                                # Extract visit count
                                visits = None
                                if total_entries_row is not None and col_idx < len(table[total_entries_row]):
                                    visit_data = table[total_entries_row][col_idx]
                                    if visit_data:
                                        # Extract number from "X visits" format
                                        match = re.search(r'(\d+)', visit_data)
                                        if match:
                                            visits = int(match.group(1))
                                
                                # Extract total time outside
                                total_time = None
                                if time_outside_row is not None and col_idx < len(table[time_outside_row]):
                                    total_time = table[time_outside_row][col_idx]
                                    if total_time:
                                        total_time = total_time.strip()
                                
                                # Create daily record
                                day_record = {
                                    'date_str': date_str,
                                    'exit_time': exit_time,
                                    'entry_time': entry_time,
                                    'duration': duration,
                                    'visits': visits,
                                    'total_time_outside': total_time
                                }
                                
                                daily_data.append(day_record)
                        
                        break  # Found the table, no need to check more pages
                
        except Exception as e:
            self.errors.append(f"Error extracting daily data from {pdf_path}: {e}")
        
        return daily_data
    
    def process_pdf(self, pdf_path: str) -> Optional[Dict]:
        """Process a single PDF file and extract all relevant data"""
        print(f"Processing: {os.path.basename(pdf_path)}")
        
        # Extract report info
        report_info = self.extract_report_info(pdf_path)
        
        # Extract daily data
        daily_data = self.extract_daily_data(pdf_path)
        
        if not daily_data:
            self.warnings.append(f"No daily data found in {pdf_path}")
            return None
        
        # Combine report info with daily data
        result = {
            'report_info': report_info,
            'daily_data': daily_data,
            'extracted_at': datetime.now().isoformat()
        }
        
        print(f"  Found {len(daily_data)} daily records")
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
            
            for daily_record in result['daily_data']:
                flat_record = {
                    'filename': report_info['filename'],
                    'report_date': report_info['report_date'],
                    'pet_name': report_info['pet_name'],
                    'age': report_info['age'],
                    'weight': report_info['weight'],
                    'date_str': daily_record['date_str'],
                    'exit_time': daily_record['exit_time'],
                    'entry_time': daily_record['entry_time'],
                    'duration': daily_record['duration'],
                    'visits': daily_record['visits'],
                    'total_time_outside': daily_record['total_time_outside'],
                    'extracted_at': result['extracted_at']
                }
                flattened.append(flat_record)
        
        return flattened
    
    def save_to_csv(self, results: List[Dict], output_path: str):
        """Save extracted data to CSV file"""
        flattened_data = self.flatten_data_for_csv(results)
        df = pd.DataFrame(flattened_data)
        df.to_csv(output_path, index=False)
        print(f"Data saved to CSV: {output_path}")
    
    def save_to_json(self, results: List[Dict], output_path: str):
        """Save extracted data to JSON file"""
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"Data saved to JSON: {output_path}")
    
    def print_summary(self, results: List[Dict]):
        """Print summary of extraction results"""
        total_records = sum(len(r['daily_data']) for r in results)
        print(f"\n=== EXTRACTION SUMMARY ===")
        print(f"Files processed: {len(results)}")
        print(f"Total daily records: {total_records}")
        
        if self.warnings:
            print(f"\nWarnings ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  ⚠️  {warning}")
        
        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors:
                print(f"  ❌ {error}")


def main():
    parser = argparse.ArgumentParser(description='Extract cat flap data from SURE Petcare PDF reports')
    parser.add_argument('input', help='PDF file or directory containing PDF files')
    parser.add_argument('--output', '-o', help='Output file path (without extension)')
    parser.add_argument('--format', '-f', choices=['csv', 'json', 'both'], default='both',
                        help='Output format (default: both)')
    
    args = parser.parse_args()
    
    extractor = CatFlapExtractor()
    
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
        args.output = f"cat_flap_data_{timestamp}"
    
    # Save output
    if args.format in ['csv', 'both']:
        extractor.save_to_csv(results, f"{args.output}.csv")
    
    if args.format in ['json', 'both']:
        extractor.save_to_json(results, f"{args.output}.json")
    
    # Print summary
    extractor.print_summary(results)


if __name__ == "__main__":
    main()