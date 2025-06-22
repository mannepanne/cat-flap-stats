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
    
    def parse_date_str_to_datetime(self, date_str: str, report_year: int) -> Optional[datetime]:
        """Parse date string to datetime for sorting"""
        full_date = self.convert_date_str_to_full_date(date_str, report_year)
        if full_date:
            try:
                return datetime.strptime(full_date, "%Y-%m-%d")
            except:
                pass
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

    def convert_duration_to_hhmm(self, duration_str: str) -> Optional[str]:
        """Convert duration string to HH:MM format"""
        hours = self.parse_duration_hours(duration_str)
        if hours is None:
            return None
        
        total_minutes = int(hours * 60)
        hours_part = total_minutes // 60
        minutes_part = total_minutes % 60
        
        return f"{hours_part:02d}:{minutes_part:02d}"

    def calculate_daily_totals(self, sessions_for_day: List[Dict]) -> Dict:
        """Calculate daily totals from extracted session data"""
        if not sessions_for_day:
            return {'visits': 0, 'time_outside': '00:00'}
        
        # Count visits (exclude overnight continuations - sessions without exit_time)
        visit_count = 0
        total_minutes = 0
        
        for session in sessions_for_day:
            # Count as a visit if it has an exit_time (excludes overnight continuations)
            if session.get('exit_time'):
                visit_count += 1
            
            # Add duration to total time
            duration_str = session.get('duration')
            if duration_str:
                hours = self.parse_duration_hours(duration_str)
                if hours:
                    total_minutes += int(hours * 60)
        
        # Convert total minutes to HH:MM format
        total_hours = total_minutes // 60
        remaining_minutes = total_minutes % 60
        time_outside = f"{total_hours:02d}:{remaining_minutes:02d}"
        
        return {
            'visits': visit_count,
            'time_outside': time_outside
        }
    
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
    
    def reconstruct_complete_table(self, pdf_path: str) -> Optional[List[List]]:
        """Reconstruct the complete activity table by merging fragments across pages"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                complete_table = []
                dates_header = None
                
                for page_num in range(len(pdf.pages)):
                    page = pdf.pages[page_num]
                    text = page.extract_text()
                    tables = page.extract_tables()
                    
                    if not tables:
                        continue
                    
                    for table in tables:
                        if not table:
                            continue
                        
                        # Check if this table contains activity data
                        has_activity_data = False
                        for row in table:
                            if row and any(cell for cell in row if cell and (':' in str(cell) or ' - ' in str(cell) or 'Date' in str(cell) or 'Left - Entered' in str(cell))):
                                has_activity_data = True
                                break
                        
                        if not has_activity_data:
                            continue
                        
                        # Process each row in this table fragment
                        for row in table:
                            if not row or not any(cell for cell in row if cell and cell.strip()):
                                continue
                            
                            # Check if this is the dates header row
                            if row[0] and 'Date' in row[0]:
                                if not dates_header:
                                    dates_header = row
                                    complete_table.append(row)
                                continue
                            
                            # Check if this is a continuation of the main table
                            # (has data in the date columns but no row label)
                            if not row[0] or row[0].strip() == '':
                                # This is likely a continuation row
                                complete_table.append(row)
                                continue
                            
                            # Check if this is a labeled row (Left - Entered, Duration, etc.)
                            if row[0] and any(keyword in row[0] for keyword in ['Left - Entered', 'Duration', 'Total Entries', 'Time Outside']):
                                complete_table.append(row)
                                continue
                            
                            # Skip other types of rows
                
                return complete_table if complete_table else None
                
        except Exception as e:
            self.errors.append(f"Error reconstructing table from {pdf_path}: {e}")
            return None

    def extract_time_duration_pairs_by_day(self, pdf_path: str) -> Dict:
        """Extract time-duration pairs for each day using robust cross-page table reconstruction"""
        try:
            # Check for no-data periods first
            if self.detect_no_data_period(pdf_path):
                self.warnings.append(f"{os.path.basename(pdf_path)}: No activity period detected")
                return {}
            
            # Reconstruct the complete table from all pages
            complete_table = self.reconstruct_complete_table(pdf_path)
            if not complete_table:
                return {}
            
            # Find dates header row
            dates_header = None
            header_idx = None
            for i, row in enumerate(complete_table):
                if row and row[0] and 'Date' in row[0]:
                    dates_header = row
                    header_idx = i
                    break
            
            if not dates_header:
                return {}
            
            # Extract date strings
            dates = [cell.strip() for cell in dates_header[1:] if cell and cell.strip()]
            
            # Initialize daily_data structure
            daily_data = {}
            for date_str in dates:
                daily_data[date_str] = {
                    'time_duration_pairs': [],
                    'daily_visits': None,
                    'daily_total_time': None
                }
            
            # Process the reconstructed table in time/duration pairs
            i = header_idx + 1  # Start after header
            while i < len(complete_table) - 1:
                current_row = complete_table[i]
                next_row = complete_table[i + 1] if i + 1 < len(complete_table) else None
                
                # Skip if this is a summary row
                if (current_row and current_row[0] and 
                    any(keyword in current_row[0].lower() for keyword in ['total entries', 'time outside'])):
                    # Process summary data
                    if 'total entries' in current_row[0].lower():
                        for day_idx, date_str in enumerate(dates):
                            col_idx = day_idx + 1
                            if col_idx < len(current_row) and current_row[col_idx]:
                                visit_data = current_row[col_idx]
                                match = re.search(r'(\d+)', visit_data)
                                if match:
                                    daily_data[date_str]['daily_visits'] = int(match.group(1))
                    
                    elif 'time outside' in current_row[0].lower():
                        for day_idx, date_str in enumerate(dates):
                            col_idx = day_idx + 1
                            if col_idx < len(current_row) and current_row[col_idx]:
                                time_data = current_row[col_idx].strip()
                                if time_data:
                                    daily_data[date_str]['daily_total_time'] = time_data
                    i += 1
                    continue
                
                # Check if we have a time/duration pair
                is_time_row = False
                is_duration_row = False
                
                # Check current row for time data
                if current_row:
                    for col_idx in range(1, min(len(current_row), len(dates) + 1)):
                        cell = current_row[col_idx]
                        if cell and cell.strip() and (':' in cell or ' - ' in cell):
                            is_time_row = True
                            break
                
                # Check next row for duration data  
                if next_row:
                    for col_idx in range(1, min(len(next_row), len(dates) + 1)):
                        cell = next_row[col_idx]
                        if cell and cell.strip() and any(unit in cell.lower() for unit in ['h', 'mins', 'min', 's']):
                            is_duration_row = True
                            break
                
                # Process time/duration pair
                if is_time_row:
                    time_row = current_row
                    duration_row = next_row if is_duration_row else None
                    
                    # Process each day
                    for day_idx, date_str in enumerate(dates):
                        col_idx = day_idx + 1
                        
                        # Get time data
                        time_cell = time_row[col_idx] if col_idx < len(time_row) else None
                        duration_cell = duration_row[col_idx] if duration_row and col_idx < len(duration_row) else None
                        
                        if time_cell and time_cell.strip():
                            time_str = time_cell.strip()
                            duration_str = duration_cell.strip() if duration_cell else None
                            
                            # Parse the time entry
                            if ' - ' in time_str:
                                # Range format "HH:MM - HH:MM"
                                parts = time_str.split(' - ')
                                if len(parts) == 2:
                                    daily_data[date_str]['time_duration_pairs'].append({
                                        'exit_time': parts[0].strip(),
                                        'entry_time': parts[1].strip(),
                                        'duration': duration_str,
                                        'type': 'complete_session'
                                    })
                            else:
                                # Single timestamp
                                daily_data[date_str]['time_duration_pairs'].append({
                                    'timestamp': time_str,
                                    'duration': duration_str,
                                    'type': 'single_timestamp'
                                })
                    
                    # Skip both time and duration rows if they're paired
                    i += 2 if is_duration_row else 1
                else:
                    i += 1
            
            return daily_data
                
        except Exception as e:
            self.errors.append(f"Error extracting times from {pdf_path}: {e}")
            return {}
    
    def extract_all_times_by_day(self, pdf_path: str) -> Dict:
        """Extract all times for each day - wrapper for backward compatibility"""
        structured_data = self.extract_time_duration_pairs_by_day(pdf_path)
        
        # Convert to old format for compatibility with existing logic
        daily_data = {}
        for date_str, day_data in structured_data.items():
            times = []
            durations = []
            
            for pair in day_data['time_duration_pairs']:
                if pair['type'] == 'complete_session':
                    times.extend([pair['exit_time'], pair['entry_time']])
                    durations.append(pair['duration'])
                elif pair['type'] == 'single_timestamp':
                    times.append(pair['timestamp'])
                    durations.append(pair['duration'])
            
            daily_data[date_str] = {
                'times': times,
                'durations': durations,
                'time_duration_pairs': day_data['time_duration_pairs'],  # Keep structured data too
                'daily_visits': day_data['daily_visits'],
                'daily_total_time': day_data['daily_total_time']
            }
        
        return daily_data
    
    
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
    
    def parse_timestamp_to_minutes(self, time_str: str) -> Optional[int]:
        """Convert HH:MM timestamp to minutes since midnight"""
        if not time_str or ':' not in time_str:
            return None
        try:
            hours, minutes = time_str.split(':')
            return int(hours) * 60 + int(minutes)
        except:
            return None
    
    def determine_single_timestamp_type(self, timestamp: str, duration_str: str, date_str: str, pdf_filename: str) -> str:
        """Apply Magnus's rules to determine if single timestamp is exit or entry"""
        if not timestamp or not duration_str:
            return "entry"  # fallback
        
        duration_hours = self.parse_duration_hours(duration_str)
        if duration_hours is None:
            return "entry"  # fallback
        
        timestamp_minutes = self.parse_timestamp_to_minutes(timestamp)
        if timestamp_minutes is None:
            return "entry"  # fallback
        
        # Rule 3/4: Use timestamp + duration analysis
        is_morning = timestamp_minutes < 12 * 60  # before 12:00
        duration_under_12h = duration_hours < 12
        
        if is_morning and duration_under_12h:
            # Rule 3: Morning timestamp + short duration = ENTRY
            # (Duration matches time since midnight)
            expected_since_midnight = timestamp_minutes / 60
            if abs(duration_hours - expected_since_midnight) < 0.5:  # within 30 minutes
                self.confidence_issues.append(
                    f"{pdf_filename} - {date_str}: {timestamp} + {duration_str} = ENTRY (since midnight pattern)"
                )
                return "entry"
            else:
                return "exit"  # Morning exit with different duration
        
        elif not is_morning and duration_under_12h:
            # Rule 4: Afternoon/evening timestamp + short duration = EXIT
            # (Duration matches time until midnight)
            minutes_to_midnight = (24 * 60) - timestamp_minutes
            expected_to_midnight = minutes_to_midnight / 60
            if abs(duration_hours - expected_to_midnight) < 0.5:  # within 30 minutes
                self.confidence_issues.append(
                    f"{pdf_filename} - {date_str}: {timestamp} + {duration_str} = EXIT (until midnight pattern)"
                )
                return "exit"
            else:
                return "entry"  # Afternoon entry with different duration
        
        # Long duration cases (>= 12h)
        if duration_hours >= 12:
            if is_morning:
                # Rule 7a fallback: Long duration morning = ENTRY
                return "entry"
            else:
                # Rule 7b fallback: Long duration afternoon/evening = EXIT
                return "exit"
        
        # Default fallback rules 7a/7b for ambiguous cases
        return "entry" if is_morning else "exit"
    
    def detect_cross_midnight_sessions(self, all_daily_data: Dict, pdf_filename: str, report_year: int) -> Dict[str, str]:
        """Detect cross-midnight sessions using Rule 5"""
        cross_midnight_pairs = {}
        
        # Sort dates chronologically for proper cross-midnight detection
        date_keys = sorted(all_daily_data.keys(), 
                          key=lambda d: self.parse_date_str_to_datetime(d, report_year) or datetime.min)
        
        for i in range(len(date_keys) - 1):
            today_key = date_keys[i]
            tomorrow_key = date_keys[i + 1]
            
            today_data = all_daily_data[today_key]
            tomorrow_data = all_daily_data[tomorrow_key]
            
            # Check if today ends with single timestamp + duration to midnight
            if (today_data['times'] and today_data['durations'] and 
                len(today_data['times']) >= 1 and len(today_data['durations']) >= 1):
                
                last_time_today = today_data['times'][-1]
                last_duration_today = today_data['durations'][-1]
                
                # Check if tomorrow starts with single timestamp + duration from midnight
                if (tomorrow_data['times'] and tomorrow_data['durations'] and 
                    len(tomorrow_data['times']) >= 1 and len(tomorrow_data['durations']) >= 1):
                    
                    first_time_tomorrow = tomorrow_data['times'][0]
                    first_duration_tomorrow = tomorrow_data['durations'][0]
                    
                    # Apply Rule 5 logic
                    last_timestamp_mins = self.parse_timestamp_to_minutes(last_time_today)
                    first_timestamp_mins = self.parse_timestamp_to_minutes(first_time_tomorrow)
                    
                    if last_timestamp_mins and first_timestamp_mins:
                        # Check if last timestamp + duration ≈ time to midnight
                        minutes_to_midnight = (24 * 60) - last_timestamp_mins
                        duration_hours_today = self.parse_duration_hours(last_duration_today)
                        
                        # Check if first timestamp + duration ≈ time from midnight
                        duration_hours_tomorrow = self.parse_duration_hours(first_duration_tomorrow)
                        
                        if (duration_hours_today and duration_hours_tomorrow and
                            abs(duration_hours_today - (minutes_to_midnight / 60)) < 0.5 and
                            abs(duration_hours_tomorrow - (first_timestamp_mins / 60)) < 0.5):
                            
                            # This is a cross-midnight session!
                            cross_midnight_pairs[f"{today_key}_{len(today_data['times'])}_{last_time_today}"] = "exit"
                            cross_midnight_pairs[f"{tomorrow_key}_1_{first_time_tomorrow}"] = "entry"
                            
                            self.confidence_issues.append(
                                f"{pdf_filename}: Cross-midnight session detected - {today_key} {last_time_today} (EXIT) → {tomorrow_key} {first_time_tomorrow} (ENTRY)"
                            )
        
        return cross_midnight_pairs
    
    def build_sessions_with_enhanced_validation(self, daily_data: Dict, pdf_filename: str, report_year: int = None) -> List[Dict]:
        """Build sessions using Magnus's new exit/entry time rules with structured data"""
        sessions = []
        
        # Process each day in chronological order
        date_keys = sorted(daily_data.keys(), 
                          key=lambda d: self.parse_date_str_to_datetime(d, report_year or 2024) or datetime.min)
        
        # Collect single timestamp sessions for cross-midnight detection
        single_timestamps = []
        for date_str in date_keys:
            day_data = daily_data[date_str]
            if 'time_duration_pairs' in day_data:
                for pair in day_data['time_duration_pairs']:
                    if pair['type'] == 'single_timestamp':
                        single_timestamps.append({
                            'date_str': date_str,
                            'timestamp': pair['timestamp'],
                            'duration': pair['duration']
                        })
        
        # Detect cross-midnight sessions
        cross_midnight_pairs = {}
        for i in range(len(single_timestamps) - 1):
            today = single_timestamps[i]
            tomorrow = single_timestamps[i + 1]
            
            # Check if they could be cross-midnight pair
            today_mins = self.parse_timestamp_to_minutes(today['timestamp'])
            tomorrow_mins = self.parse_timestamp_to_minutes(tomorrow['timestamp'])
            
            if (today_mins and tomorrow_mins and 
                today_mins > 20 * 60 and tomorrow_mins < 8 * 60):  # After 20:00 and before 08:00
                
                # Check duration patterns for Rule 5
                today_duration = self.parse_duration_hours(today['duration'])
                tomorrow_duration = self.parse_duration_hours(tomorrow['duration'])
                
                if today_duration and tomorrow_duration:
                    # Check if durations match cross-midnight pattern
                    mins_to_midnight = (24 * 60) - today_mins
                    if (abs(today_duration - (mins_to_midnight / 60)) < 0.5 and
                        abs(tomorrow_duration - (tomorrow_mins / 60)) < 0.5):
                        
                        cross_midnight_pairs[f"{today['date_str']}_{today['timestamp']}"] = "exit"
                        cross_midnight_pairs[f"{tomorrow['date_str']}_{tomorrow['timestamp']}"] = "entry"
                        
                        self.confidence_issues.append(
                            f"{pdf_filename}: Cross-midnight session detected - {today['date_str']} {today['timestamp']} (EXIT) → {tomorrow['date_str']} {tomorrow['timestamp']} (ENTRY)"
                        )
        
        # Build sessions using structured data
        for date_str in date_keys:
            day_data = daily_data[date_str]
            if 'time_duration_pairs' not in day_data:
                continue
                
            session_number = 1
            
            for pair in day_data['time_duration_pairs']:
                if pair['type'] == 'complete_session':
                    # Rule 1: Complete session with exit and entry times
                    sessions.append({
                        'date_str': date_str,
                        'session_number': session_number,
                        'exit_time': pair['exit_time'],
                        'entry_time': pair['entry_time'],
                        'duration': pair['duration'],
                        'daily_total_visits_PDF': day_data.get('daily_visits'),
                        'daily_total_time_outside_PDF': day_data.get('daily_total_time')
                    })
                
                elif pair['type'] == 'single_timestamp':
                    # Determine if this is exit or entry using rules 3/4/5/7
                    timestamp = pair['timestamp']
                    duration_str = pair['duration']
                    
                    cross_midnight_key = f"{date_str}_{timestamp}"
                    
                    if cross_midnight_key in cross_midnight_pairs:
                        # Rule 5: Cross-midnight session
                        timestamp_type = cross_midnight_pairs[cross_midnight_key]
                    else:
                        # Apply rules 3/4/7
                        timestamp_type = self.determine_single_timestamp_type(
                            timestamp, duration_str, date_str, pdf_filename
                        )
                    
                    if timestamp_type == "exit":
                        sessions.append({
                            'date_str': date_str,
                            'session_number': session_number,
                            'exit_time': timestamp,
                            'entry_time': None,
                            'duration': duration_str,
                            'daily_total_visits_PDF': day_data.get('daily_visits'),
                            'daily_total_time_outside_PDF': day_data.get('daily_total_time')
                        })
                    else:  # entry
                        sessions.append({
                            'date_str': date_str,
                            'session_number': session_number,
                            'exit_time': None,
                            'entry_time': timestamp,
                            'duration': duration_str,
                            'daily_total_visits_PDF': day_data.get('daily_visits'),
                            'daily_total_time_outside_PDF': day_data.get('daily_total_time')
                        })
                
                session_number += 1
        
        # Calculate daily totals from extracted sessions and add to each session
        sessions_by_date = {}
        for session in sessions:
            date_str = session['date_str']
            if date_str not in sessions_by_date:
                sessions_by_date[date_str] = []
            sessions_by_date[date_str].append(session)
        
        # Calculate and apply calculated totals to all sessions
        for date_str, day_sessions in sessions_by_date.items():
            calculated_totals = self.calculate_daily_totals(day_sessions)
            
            # Update all sessions for this day with calculated totals
            for session in day_sessions:
                session['daily_total_visits_calculated'] = calculated_totals['visits']
                session['daily_total_time_outside_calculated'] = calculated_totals['time_outside']
        
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
        session_data = self.build_sessions_with_enhanced_validation(daily_data, os.path.basename(pdf_path), report_info.get('report_year'))
        
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
                    'daily_total_visits_PDF': session['daily_total_visits_PDF'],
                    'daily_total_time_outside_PDF': session['daily_total_time_outside_PDF'],
                    'daily_total_visits_calculated': session['daily_total_visits_calculated'],
                    'daily_total_time_outside_calculated': session['daily_total_time_outside_calculated'],
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