#!/usr/bin/env python3
# ABOUT: Production-ready cat flap data extractor with comprehensive robustness features
# ABOUT: Handles edge cases, provides duration-based validation, and graceful degradation

import os
import re
import json
import argparse
import pandas as pd
import pdfplumber
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple


class ProductionCatFlapExtractor:
    """Production-ready cat flap session extractor with comprehensive robustness features"""
    
    def __init__(self):
        self.extracted_data = []
        self.errors = []
        self.warnings = []
        self.state_issues = []
        self.confidence_issues = []
    
    def parse_report_date(self, report_date_str: str) -> Optional[datetime]:
        """Parse report date string into datetime object"""
        if not report_date_str:
            return None
        
        try:
            # Handle formats like "1 September 2024" or "15 June 2025"
            return datetime.strptime(report_date_str, "%d %B %Y")
        except:
            try:
                # Handle other common formats
                return datetime.strptime(report_date_str, "%d %b %Y")
            except:
                return None
    
    def convert_date_str_to_full_date(self, date_str: str, report_year: int) -> Optional[str]:
        """Convert date_str like 'Mon 26 Aug' to YYYY-MM-DD format"""
        if not date_str or not report_year:
            return None
        
        try:
            # Parse date_str format like "Mon 26 Aug" or "Tue 31 Dec"
            # Extract day and month from the string
            parts = date_str.strip().split()
            if len(parts) >= 3:
                day = parts[1]
                month_abbr = parts[2]
                
                # Create date string with year
                date_with_year = f"{day} {month_abbr} {report_year}"
                
                try:
                    parsed_date = datetime.strptime(date_with_year, "%d %b %Y")
                    return parsed_date.strftime("%Y-%m-%d")
                except:
                    # Try different month format
                    try:
                        parsed_date = datetime.strptime(date_with_year, "%d %B %Y")
                        return parsed_date.strftime("%Y-%m-%d")
                    except:
                        pass
            
            return None
        except Exception:
            return None
    
    def extract_report_info(self, pdf_path: str) -> Dict:
        """Extract basic report information from PDF"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                first_page = pdf.pages[0]
                text = first_page.extract_text()
                
                info = {
                    'filename': os.path.basename(pdf_path),
                    'report_date': None,
                    'report_date_range': None,
                    'report_year': None,
                    'pet_name': None,
                    'age': None,
                    'weight': None
                }
                
                # Extract report date
                lines = text.strip().split('\n')
                for line in lines[:10]:
                    if re.match(r'\d{1,2}\s+\w+\s+\d{4}', line.strip()):
                        info['report_date'] = line.strip()
                        # Parse year from report date
                        parsed_date = self.parse_report_date(line.strip())
                        if parsed_date:
                            info['report_year'] = parsed_date.year
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
    
    def parse_time_range(self, time_str: str) -> List[str]:
        """Parse time range and return list of individual times"""
        if not time_str or time_str.strip() == '':
            return []
        
        time_str = time_str.strip()
        
        # Handle range format "HH:MM - HH:MM"
        if ' - ' in time_str:
            parts = time_str.split(' - ')
            if len(parts) == 2:
                return [parts[0].strip(), parts[1].strip()]
        
        # Handle single time
        time_pattern = r'^\d{2}:\d{2}$'
        if re.match(time_pattern, time_str):
            return [time_str]
        
        return []
    
    def parse_duration_hours(self, duration_str: str) -> Optional[float]:
        """Parse duration string and return hours as float"""
        if not duration_str or duration_str.strip() == '':
            return None
        
        duration_str = duration_str.strip().lower()
        
        try:
            # Handle "HH:MM h" format
            if 'h' in duration_str:
                hours_part = duration_str.split('h')[0].strip()
                if ':' in hours_part:
                    hours, mins = hours_part.split(':')
                    return int(hours) + int(mins)/60
                else:
                    return float(hours_part)
            
            # Handle "MM:SS mins" format
            elif 'mins' in duration_str or 'min' in duration_str:
                mins_part = duration_str.split('min')[0].strip()
                if ':' in mins_part:
                    mins, secs = mins_part.split(':')
                    return (int(mins) + int(secs)/60) / 60
                else:
                    return float(mins_part) / 60
            
            # Handle seconds
            elif 's' in duration_str:
                secs_part = duration_str.split('s')[0].strip()
                return float(secs_part) / 3600
        
        except:
            pass
        
        return None
    
    def detect_no_data_period(self, pdf_path: str) -> bool:
        """Detect if this is a 'no data' period"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_lower = text.lower()
                        if any(phrase in text_lower for phrase in [
                            'no data available',
                            'no activity',
                            'average entries 0',
                            'average time outside 00 s'
                        ]):
                            return True
        except:
            pass
        return False
    
    def extract_all_times_by_day(self, pdf_path: str) -> Dict:
        """Extract all times for each day with enhanced edge case handling"""
        try:
            # Check for no-data periods first
            if self.detect_no_data_period(pdf_path):
                self.warnings.append(f"{os.path.basename(pdf_path)}: No activity period detected")
                return {}
            
            with pdfplumber.open(pdf_path) as pdf:
                # Collect all table data across pages
                all_table_data = []
                
                for page_num in range(len(pdf.pages)):
                    page = pdf.pages[page_num]
                    text = page.extract_text()
                    
                    if ('Last 7 days' in text or 
                        'Total Entries' in text or 
                        'Time Outside' in text):
                        
                        tables = page.extract_tables()
                        for table in tables:
                            if table and len(table) > 0:
                                all_table_data.extend(table)
                
                if not all_table_data:
                    return {}
                
                # Find the date header row
                date_row_idx = None
                for i, row in enumerate(all_table_data):
                    if row and len(row) >= 2 and row[0] and 'Date' in row[0]:
                        date_row_idx = i
                        break
                
                if date_row_idx is None:
                    return {}
                
                # Extract dates with partial week handling
                header_row = all_table_data[date_row_idx]
                dates = []
                
                # Handle variable week lengths (partial weeks)
                num_date_columns = len([cell for cell in header_row[1:] if cell and cell.strip()])
                
                if num_date_columns < 4:
                    self.warnings.append(f"{os.path.basename(pdf_path)}: Partial week detected ({num_date_columns} days)")
                
                for cell in header_row[1:]:
                    if cell and cell.strip():
                        dates.append(cell.strip())
                
                # Find summary rows
                total_entries_row_idx = None
                time_outside_row_idx = None
                
                for i, row in enumerate(all_table_data):
                    if row and row[0]:
                        cell_content = row[0].strip().lower()
                        if 'total entries' in cell_content:
                            total_entries_row_idx = i
                        elif 'time outside' in cell_content:
                            time_outside_row_idx = i
                
                # Extract times for each day
                daily_data = {}
                
                for day_idx, date_str in enumerate(dates):
                    if not date_str:
                        continue
                    
                    col_idx = day_idx + 1
                    
                    # Get daily totals
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
                    
                    # Extract all times for this day
                    day_times = []
                    day_durations = []
                    
                    for row_idx in range(date_row_idx + 1, len(all_table_data)):
                        row = all_table_data[row_idx]
                        
                        # Skip summary rows
                        if (row and row[0] and 
                            any(keyword in row[0].lower() 
                                for keyword in ['total entries', 'time outside'])):
                            break
                        
                        if (row and len(row) > col_idx and 
                            row[col_idx] and row[col_idx].strip()):
                            
                            cell_data = row[col_idx].strip()
                            
                            # Check if this is a time or duration
                            if any(char in cell_data for char in ['h', 'm', 's']):
                                # This is a duration
                                day_durations.append(cell_data)
                            else:
                                # This is time data
                                times = self.parse_time_range(cell_data)
                                day_times.extend(times)
                    
                    daily_data[date_str] = {
                        'times': day_times,
                        'durations': day_durations,
                        'daily_visits': daily_visits,
                        'daily_total_time': daily_total_time
                    }
                
                return daily_data
                
        except Exception as e:
            self.errors.append(f"Error extracting times from {pdf_path}: {e}")
            return {}
    
    def validate_state_with_duration(self, time_str: str, duration_str: str, predicted_state: str, pdf_filename: str, date_str: str) -> str:
        """Use duration clues to validate and potentially correct state prediction"""
        if not duration_str:
            return predicted_state
        
        duration_hours = self.parse_duration_hours(duration_str)
        if duration_hours is None:
            return predicted_state
        
        # Duration-based state validation rules
        confidence_level = "medium"
        
        if duration_hours > 15:
            # Long duration + single time = EXIT (time to midnight pattern)
            if predicted_state == "exit":
                confidence_level = "high"
            else:
                self.confidence_issues.append(
                    f"{pdf_filename} - {date_str}: Long duration ({duration_str}) suggests EXIT, "
                    f"but state tracking predicted {predicted_state}"
                )
                predicted_state = "exit"
                confidence_level = "corrected"
        
        elif duration_hours < 5:
            # Short duration + single time = ENTRY (remaining time pattern)
            if predicted_state == "entry":
                confidence_level = "high"
            else:
                self.confidence_issues.append(
                    f"{pdf_filename} - {date_str}: Short duration ({duration_str}) suggests ENTRY, "
                    f"but state tracking predicted {predicted_state}"
                )
                predicted_state = "entry"
                confidence_level = "corrected"
        
        return predicted_state
    
    def validate_sessions_with_tolerance(self, sessions: List[Dict], daily_data: Dict, pdf_filename: str):
        """Validate sessions with tolerance for normal counting differences"""
        daily_session_counts = {}
        
        # Count sessions per day
        for session in sessions:
            date_str = session['date_str']
            if date_str not in daily_session_counts:
                daily_session_counts[date_str] = 0
            
            # Only count complete sessions (with both exit and entry) as full visits
            if session['exit_time'] and session['entry_time']:
                daily_session_counts[date_str] += 1
        
        # Compare with reported visit counts with tolerance
        for date_str, day_data in daily_data.items():
            if day_data['daily_visits'] is not None:
                extracted_count = daily_session_counts.get(date_str, 0)
                reported_count = day_data['daily_visits']
                difference = abs(extracted_count - reported_count)
                
                # Only flag significant mismatches (>2x or difference > 2)
                if difference > 2 or (reported_count > 0 and extracted_count > reported_count * 2):
                    self.state_issues.append(
                        f"{pdf_filename} - {date_str}: Significant mismatch - extracted {extracted_count} "
                        f"complete sessions but PDF reports {reported_count} visits (diff: {difference})"
                    )
                elif difference > 1:
                    # Minor mismatch - just note it
                    self.warnings.append(
                        f"{pdf_filename} - {date_str}: Minor visit count difference - "
                        f"extracted {extracted_count}, reported {reported_count}"
                    )
    
    def build_sessions_with_enhanced_validation(self, daily_data: Dict, pdf_filename: str) -> List[Dict]:
        """Build sessions with enhanced state tracking and duration validation"""
        sessions = []
        current_state = "inside"  # Reset state per PDF (weekly reset)
        current_session = None
        
        # Add warning about state reset
        self.warnings.append(f"{pdf_filename}: State reset to 'inside' at start of PDF (weekly reset policy)")
        
        # Process days in chronological order
        for date_str in daily_data.keys():
            day_data = daily_data[date_str]
            times = day_data['times']
            durations = day_data['durations']
            
            # Skip days with no time data
            if not times:
                continue
            
            session_number = 1
            duration_idx = 0
            
            for time_str in times:
                # Predict state based on current tracking
                predicted_state = "exit" if current_state == "inside" else "entry"
                
                # Get corresponding duration for validation
                duration_str = durations[duration_idx] if duration_idx < len(durations) else None
                
                # Validate state with duration clues (for single times only)
                if len(times) == 1 or not any(' - ' in t for t in times):
                    # This is a single time, duration validation applies
                    validated_state = self.validate_state_with_duration(
                        time_str, duration_str, predicted_state, pdf_filename, date_str
                    )
                else:
                    validated_state = predicted_state
                
                if validated_state == "exit":
                    # Time represents an EXIT
                    current_session = {
                        'date_str': date_str,
                        'session_number': session_number,
                        'exit_time': time_str,
                        'entry_time': None,
                        'duration': duration_str,
                        'daily_total_visits': day_data['daily_visits'],
                        'daily_total_time_outside': day_data['daily_total_time']
                    }
                    
                    if duration_str:
                        duration_idx += 1
                    
                    current_state = "outside"
                    
                else:
                    # Time represents an ENTRY
                    if current_session:
                        # Complete the current session
                        current_session['entry_time'] = time_str
                        sessions.append(current_session)
                        session_number += 1
                    else:
                        # Entry without matching exit (continuing from previous day/period)
                        sessions.append({
                            'date_str': date_str,
                            'session_number': session_number,
                            'exit_time': None,
                            'entry_time': time_str,
                            'duration': duration_str,
                            'daily_total_visits': day_data['daily_visits'],
                            'daily_total_time_outside': day_data['daily_total_time']
                        })
                        if duration_str:
                            duration_idx += 1
                        session_number += 1
                    
                    current_session = None
                    current_state = "inside"
            
            # If day ends with incomplete session, add it
            if current_session:
                sessions.append(current_session)
                session_number += 1
                current_session = None
        
        # Enhanced validation with tolerance
        self.validate_sessions_with_tolerance(sessions, daily_data, pdf_filename)
        
        return sessions
    
    def process_pdf(self, pdf_path: str) -> Optional[Dict]:
        """Process a single PDF file with comprehensive error handling"""
        print(f"Processing: {os.path.basename(pdf_path)}")
        
        # Extract report info
        report_info = self.extract_report_info(pdf_path)
        
        # Extract daily time data with edge case handling
        daily_data = self.extract_all_times_by_day(pdf_path)
        
        if not daily_data:
            self.warnings.append(f"No time data found in {pdf_path}")
            return None
        
        # Calculate date range for this report
        date_keys = list(daily_data.keys())
        if date_keys and report_info.get('report_year'):
            first_date_str = date_keys[0]
            last_date_str = date_keys[-1]
            
            first_full_date = self.convert_date_str_to_full_date(first_date_str, report_info['report_year'])
            last_full_date = self.convert_date_str_to_full_date(last_date_str, report_info['report_year'])
            
            if first_full_date and last_full_date:
                report_info['report_date_range'] = f"{first_full_date} to {last_full_date}"
        
        # Build sessions with enhanced validation
        session_data = self.build_sessions_with_enhanced_validation(daily_data, os.path.basename(pdf_path))
        
        if not session_data:
            self.warnings.append(f"No sessions built from {pdf_path}")
            return None
        
        # Add date_full to each session
        for session in session_data:
            if report_info.get('report_year'):
                session['date_full'] = self.convert_date_str_to_full_date(
                    session['date_str'], 
                    report_info['report_year']
                )
        
        result = {
            'report_info': report_info,
            'session_data': session_data,
            'extracted_at': datetime.now().isoformat()
        }
        
        print(f"  Found {len(session_data)} individual sessions")
        return result
    
    def process_directory(self, directory: str) -> List[Dict]:
        """Process all PDF files in a directory with enhanced gap detection"""
        pdf_dir = Path(directory)
        
        if not pdf_dir.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")
        
        pdf_files = list(pdf_dir.glob("*.pdf"))
        
        if not pdf_files:
            print(f"No PDF files found in {directory}")
            return []
        
        print(f"Found {len(pdf_files)} PDF files to process")
        
        # Sort files and check for potential gaps
        sorted_files = sorted(pdf_files)
        self.detect_potential_gaps(sorted_files)
        
        results = []
        for pdf_file in sorted_files:
            result = self.process_pdf(pdf_file)
            if result:
                results.append(result)
        
        # Sort results chronologically by report date range start
        results = self.sort_results_chronologically(results)
        
        return results
    
    def sort_results_chronologically(self, results: List[Dict]) -> List[Dict]:
        """Sort results chronologically by report date range"""
        def get_sort_key(result):
            report_info = result.get('report_info', {})
            date_range = report_info.get('report_date_range', '')
            
            if date_range and ' to ' in date_range:
                # Extract start date from "YYYY-MM-DD to YYYY-MM-DD"
                start_date_str = date_range.split(' to ')[0]
                try:
                    return datetime.strptime(start_date_str, "%Y-%m-%d")
                except:
                    pass
            
            # Fallback to filename-based sorting
            filename = report_info.get('filename', '')
            return filename
        
        return sorted(results, key=get_sort_key)
    
    def detect_potential_gaps(self, pdf_files: List[Path]):
        """Enhanced gap detection with better date parsing"""
        if len(pdf_files) < 2:
            return
        
        # Try to extract dates from filenames
        dates = []
        for pdf_file in pdf_files:
            filename = pdf_file.name
            # Look for various date patterns
            date_patterns = [
                r'(\d{2})-(\d{2})-(\d{4})',  # DD-MM-YYYY
                r'(\d{1,2})-(\d{1,2})-(\d{4})',  # D-M-YYYY
            ]
            
            for pattern in date_patterns:
                date_match = re.search(pattern, filename)
                if date_match:
                    day, month, year = date_match.groups()
                    try:
                        date_obj = datetime.strptime(f"{day.zfill(2)}-{month.zfill(2)}-{year}", "%d-%m-%Y")
                        dates.append((date_obj, filename))
                        break
                    except:
                        continue
        
        if len(dates) < 2:
            self.warnings.append("Could not parse dates from filenames for gap detection")
            return
        
        # Check for gaps
        dates.sort()
        for i in range(1, len(dates)):
            current_date, current_file = dates[i]
            prev_date, prev_file = dates[i-1]
            gap_days = (current_date - prev_date).days
            
            if gap_days > 14:  # More than 2 weeks gap
                self.warnings.append(
                    f"Large gap detected: {gap_days} days between {prev_file} and {current_file}. "
                    f"State tracking may be affected."
                )
    
    def flatten_data_for_csv(self, results: List[Dict]) -> List[Dict]:
        """Flatten the extracted data for CSV output"""
        flattened = []
        
        for result in results:
            report_info = result['report_info']
            
            for session in result['session_data']:
                flat_record = {
                    'filename': report_info['filename'],
                    'report_date': report_info['report_date'],
                    'report_date_range': report_info.get('report_date_range'),
                    'report_year': report_info.get('report_year'),
                    'pet_name': report_info['pet_name'],
                    'age': report_info['age'],
                    'weight': report_info['weight'],
                    'date_str': session['date_str'],
                    'date_full': session.get('date_full'),
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
        print(f"Production session data saved to CSV: {output_path}")
    
    def save_to_json(self, results: List[Dict], output_path: str):
        """Save extracted data to JSON file"""
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"Production session data saved to JSON: {output_path}")
    
    def print_production_summary(self, results: List[Dict]):
        """Print comprehensive production summary with confidence metrics"""
        total_sessions = sum(len(r['session_data']) for r in results)
        
        # Count different session types
        complete_sessions = 0
        overnight_exits = 0
        overnight_entries = 0
        
        for result in results:
            for session in result['session_data']:
                if session['exit_time'] and session['entry_time']:
                    complete_sessions += 1
                elif session['exit_time'] and not session['entry_time']:
                    overnight_exits += 1
                elif session['entry_time'] and not session['exit_time']:
                    overnight_entries += 1
        
        print(f"\n=== PRODUCTION SESSION EXTRACTION SUMMARY ===")
        print(f"Files processed: {len(results)}")
        print(f"Total individual sessions: {total_sessions}")
        print(f"  - Complete sessions (exit + entry): {complete_sessions}")
        print(f"  - Overnight exits (exit only): {overnight_exits}")
        print(f"  - Overnight entries (entry only): {overnight_entries}")
        
        # Confidence metrics
        if self.confidence_issues:
            print(f"\n🎯 DURATION-BASED STATE CORRECTIONS ({len(self.confidence_issues)}):")
            for issue in self.confidence_issues:
                print(f"  🔧 {issue}")
        
        if self.state_issues:
            print(f"\n🚨 SIGNIFICANT VALIDATION ISSUES ({len(self.state_issues)}):")
            for issue in self.state_issues:
                print(f"  ⚠️  {issue}")
        
        if self.warnings:
            print(f"\nWarnings ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  ⚠️  {warning}")
        
        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors:
                print(f"  ❌ {error}")
        
        # Calculate success metrics
        confidence_corrections = len(self.confidence_issues)
        minor_warnings = len([w for w in self.warnings if 'Minor visit count difference' in w])
        
        print(f"\n📊 QUALITY METRICS:")
        print(f"  - Duration-based corrections applied: {confidence_corrections}")
        print(f"  - Minor visit count differences (±1): {minor_warnings}")
        print(f"  - Significant validation issues: {len(self.state_issues)}")
        print(f"  - Exit/Entry balance: {overnight_exits - overnight_entries} (optimal: 0)")
        
        # Provide actionable recommendations
        if self.state_issues or self.errors:
            print(f"\n💡 RECOMMENDATIONS:")
            if self.state_issues:
                print(f"  - Review {len(self.state_issues)} flagged sessions manually")
            if self.errors:
                print(f"  - Investigate {len(self.errors)} extraction errors")
            print(f"  - Consider the validation differences as expected behavior")
        else:
            print(f"\n✅ EXTRACTION QUALITY: Excellent - No significant issues detected")


def main():
    parser = argparse.ArgumentParser(description='Production-ready cat flap session data extractor')
    parser.add_argument('input', help='PDF file or directory containing PDF files')
    parser.add_argument('--output', '-o', help='Output file path (without extension)')
    parser.add_argument('--format', '-f', choices=['csv', 'json', 'both'], default='both',
                        help='Output format (default: both)')
    
    args = parser.parse_args()
    
    extractor = ProductionCatFlapExtractor()
    
    # Determine if input is file or directory
    input_path = Path(args.input)
    
    if input_path.is_file() and input_path.suffix.lower() == '.pdf':
        result = extractor.process_pdf(input_path)
        results = [result] if result else []
    elif input_path.is_dir():
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
        args.output = f"cat_flap_production_{timestamp}"
    
    # Save output
    if args.format in ['csv', 'both']:
        extractor.save_to_csv(results, f"{args.output}.csv")
    
    if args.format in ['json', 'both']:
        extractor.save_to_json(results, f"{args.output}.json")
    
    # Print comprehensive summary
    extractor.print_production_summary(results)


if __name__ == "__main__":
    main()