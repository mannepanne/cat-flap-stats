#!/usr/bin/env python3
"""
ABOUT: Compute pre-computed analytics for cat flap behavioral analysis
ABOUT: Generates statistical summaries and patterns for dashboard visualization
"""

import json
import pandas as pd
from datetime import datetime, timedelta
import numpy as np
from collections import defaultdict
import math

class CatFlapAnalytics:
    """Compute behavioral analytics from cat flap session data"""
    
    def __init__(self, json_path):
        """Initialize with existing master dataset JSON"""
        with open(json_path, 'r') as f:
            self.data = json.load(f)
        
        # Flatten session data for analysis
        self.sessions = []
        for report in self.data:
            if 'session_data' in report:
                for session in report['session_data']:
                    session_copy = session.copy()
                    session_copy['report_date'] = report['report_info']['report_date']
                    self.sessions.append(session_copy)
        
        self.df = pd.DataFrame(self.sessions)
        if not self.df.empty:
            self.df['date_full'] = pd.to_datetime(self.df['date_full'])
            # Add helper columns
            self.df['weekday'] = self.df['date_full'].dt.day_name()
            self.df['is_weekend'] = self.df['date_full'].dt.dayofweek >= 5
            self.df['season'] = self.df['date_full'].apply(self._get_season)
            self.df['hour_exit'] = self.df['exit_time'].apply(self._time_to_hour)
            self.df['hour_entry'] = self.df['entry_time'].apply(self._time_to_hour)
    
    def _get_season(self, date):
        """Determine season based on date"""
        month = date.month
        if month in [12, 1, 2]:
            return 'winter'
        elif month in [3, 4, 5]:
            return 'spring'
        elif month in [6, 7, 8]:
            return 'summer'
        else:
            return 'autumn'
    
    def _time_to_hour(self, time_str):
        """Convert time string to hour (24-hour format)"""
        if pd.isna(time_str) or time_str is None:
            return None
        try:
            return int(time_str.split(':')[0])
        except:
            return None
    
    def _parse_duration(self, duration_str):
        """Parse duration string to minutes"""
        if pd.isna(duration_str) or duration_str is None:
            return 0
        
        try:
            # Handle different duration formats
            if 'h' in duration_str:
                if 'mins' in duration_str:
                    # Format: "01:38 h" or "05:35 h"
                    hours = float(duration_str.split(':')[0])
                    minutes = float(duration_str.split(':')[1].split(' ')[0])
                    return hours * 60 + minutes
                else:
                    # Format: "05:35 h"
                    parts = duration_str.replace(' h', '').split(':')
                    hours = float(parts[0])
                    minutes = float(parts[1]) if len(parts) > 1 else 0
                    return hours * 60 + minutes
            elif 'mins' in duration_str:
                # Format: "21:12 mins"
                parts = duration_str.replace(' mins', '').split(':')
                return float(parts[0]) + float(parts[1]) / 60
            else:
                return 0
        except:
            return 0
    
    def compute_daily_summaries(self):
        """Compute daily activity summaries"""
        if self.df.empty:
            return []
        
        daily_groups = self.df.groupby('date_full')
        summaries = []
        
        for date, group in daily_groups:
            # Find first exit and last entry of the day
            exits = group[group['exit_time'].notna()]['exit_time']
            entries = group[group['entry_time'].notna()]['entry_time']
            
            first_exit = exits.min() if not exits.empty else None
            last_entry = entries.max() if not entries.empty else None
            
            # Calculate total outdoor time
            total_time = group['duration'].apply(self._parse_duration).sum()
            
            summary = {
                'date': date.strftime('%Y-%m-%d'),
                'sessions': len(group),
                'firstExit': first_exit,
                'lastEntry': last_entry,
                'totalOutdoorTime': f"{int(total_time // 60):02d}:{int(total_time % 60):02d}",
                'isWeekend': date.weekday() >= 5
            }
            summaries.append(summary)
        
        return sorted(summaries, key=lambda x: x['date'])
    
    def compute_peak_hours(self):
        """Compute peak activity hours"""
        if self.df.empty:
            return []
        
        # Count exits and entries by hour
        exit_counts = defaultdict(int)
        entry_counts = defaultdict(int)
        total_days = len(self.df['date_full'].unique())
        
        for _, session in self.df.iterrows():
            if session['hour_exit'] is not None:
                exit_counts[session['hour_exit']] += 1
            if session['hour_entry'] is not None:
                entry_counts[session['hour_entry']] += 1
        
        # Calculate frequencies (events per day)
        peak_hours = []
        for hour in range(24):
            exit_freq = exit_counts[hour] / total_days if total_days > 0 else 0
            entry_freq = entry_counts[hour] / total_days if total_days > 0 else 0
            
            peak_hours.append({
                'hour': hour,
                'exitFrequency': round(exit_freq, 3),
                'entryFrequency': round(entry_freq, 3)
            })
        
        return peak_hours
    
    def compute_seasonal_stats(self):
        """Compute seasonal behavioral statistics"""
        if self.df.empty:
            return {}
        
        seasonal_data = {}
        
        for season in ['spring', 'summer', 'autumn', 'winter']:
            season_df = self.df[self.df['season'] == season]
            if season_df.empty:
                continue
            
            # Daily session averages
            daily_sessions = season_df.groupby('date_full').size()
            avg_sessions = daily_sessions.mean() if not daily_sessions.empty else 0
            
            # Average first exit time
            first_exits = []
            for date, group in season_df.groupby('date_full'):
                exits = group[group['exit_time'].notna()]['exit_time']
                if not exits.empty:
                    first_exit = exits.min()
                    # Convert to minutes since midnight for averaging
                    try:
                        hour, minute = first_exit.split(':')
                        minutes = int(hour) * 60 + int(minute)
                        first_exits.append(minutes)
                    except:
                        continue
            
            avg_first_exit_mins = np.mean(first_exits) if first_exits else 0
            avg_first_exit = f"{int(avg_first_exit_mins // 60):02d}:{int(avg_first_exit_mins % 60):02d}"
            
            seasonal_data[season] = {
                'avgDailySessions': round(avg_sessions, 1),
                'avgFirstExit': avg_first_exit
            }
        
        return seasonal_data
    
    def compute_weekday_patterns(self):
        """Compute weekday vs weekend patterns"""
        if self.df.empty:
            return {}
        
        patterns = {}
        
        for is_weekend, weekend_label in [(False, 'weekdays'), (True, 'weekends')]:
            subset = self.df[self.df['is_weekend'] == is_weekend]
            if subset.empty:
                continue
            
            # Average first exit time
            first_exits = []
            last_entries = []
            
            for date, group in subset.groupby('date_full'):
                exits = group[group['exit_time'].notna()]['exit_time']
                entries = group[group['entry_time'].notna()]['entry_time']
                
                if not exits.empty:
                    first_exit = exits.min()
                    try:
                        hour, minute = first_exit.split(':')
                        first_exits.append(int(hour) * 60 + int(minute))
                    except:
                        pass
                
                if not entries.empty:
                    last_entry = entries.max()
                    try:
                        hour, minute = last_entry.split(':')
                        last_entries.append(int(hour) * 60 + int(minute))
                    except:
                        pass
            
            avg_first_exit_mins = np.mean(first_exits) if first_exits else 0
            avg_last_entry_mins = np.mean(last_entries) if last_entries else 0
            
            patterns[weekend_label] = {
                'avgFirstExit': f"{int(avg_first_exit_mins // 60):02d}:{int(avg_first_exit_mins % 60):02d}",
                'avgLastEntry': f"{int(avg_last_entry_mins // 60):02d}:{int(avg_last_entry_mins % 60):02d}"
            }
        
        return patterns
    
    def compute_data_quality(self):
        """Compute data quality metrics"""
        if self.df.empty:
            return {
                'completeDays': 0,
                'partialDays': 0,
                'confidenceScore': 0.0
            }
        
        # Count complete vs partial days
        daily_counts = self.df.groupby('date_full').size()
        complete_days = len(daily_counts[daily_counts >= 2])  # At least 2 sessions
        partial_days = len(daily_counts[daily_counts == 1])   # Only 1 session
        
        # Calculate confidence score based on data completeness
        total_days = len(daily_counts)
        confidence = complete_days / total_days if total_days > 0 else 0
        
        return {
            'completeDays': complete_days,
            'partialDays': partial_days,
            'confidenceScore': round(confidence, 2)
        }
    
    def generate_enhanced_json(self, output_path):
        """Generate enhanced JSON with precomputed analytics"""
        if not self.data:
            enhanced_data = {
                'metadata': {
                    'lastUpdated': datetime.now().isoformat() + 'Z',
                    'totalSessions': 0,
                    'dateRange': 'No data available',
                    'dataQuality': self.compute_data_quality()
                },
                'precomputed': {
                    'dailySummaries': [],
                    'peakHours': [],
                    'seasonalStats': {},
                    'weekdayPatterns': {}
                },
                'sessions': [],
                'annotations': []
            }
        else:
            # Calculate metadata
            total_sessions = len(self.sessions)
            
            if self.sessions:
                dates = [session['date_full'] for session in self.sessions if 'date_full' in session]
                if dates:
                    date_range = f"{min(dates)} to {max(dates)}"
                else:
                    date_range = 'Date range not available'
            else:
                date_range = 'No sessions available'
            
            enhanced_data = {
                'metadata': {
                    'lastUpdated': datetime.now().isoformat() + 'Z',
                    'totalSessions': total_sessions,
                    'dateRange': date_range,
                    'dataQuality': self.compute_data_quality()
                },
                'precomputed': {
                    'dailySummaries': self.compute_daily_summaries(),
                    'peakHours': self.compute_peak_hours(),
                    'seasonalStats': self.compute_seasonal_stats(),
                    'weekdayPatterns': self.compute_weekday_patterns()
                },
                'sessions': self.data,  # Include original session data
                'annotations': []  # Placeholder for future annotation system
            }
        
        # Write enhanced JSON
        with open(output_path, 'w') as f:
            json.dump(enhanced_data, f, indent=2)
        
        print(f"Enhanced JSON with analytics generated: {output_path}")
        return enhanced_data

def main():
    """Main function to compute analytics for master dataset"""
    try:
        print("Computing analytics for master dataset...")
        
        # Initialize analytics computer
        analytics = CatFlapAnalytics('master_dataset.json')
        
        # Generate enhanced JSON with precomputed analytics
        enhanced_data = analytics.generate_enhanced_json('master_dataset.json')
        
        # Print summary
        print(f"Analytics computation completed:")
        print(f"- Total sessions: {enhanced_data['metadata']['totalSessions']}")
        print(f"- Date range: {enhanced_data['metadata']['dateRange']}")
        print(f"- Daily summaries: {len(enhanced_data['precomputed']['dailySummaries'])}")
        print(f"- Peak hours computed: {len(enhanced_data['precomputed']['peakHours'])}")
        print(f"- Seasonal patterns: {len(enhanced_data['precomputed']['seasonalStats'])}")
        print(f"- Data quality score: {enhanced_data['metadata']['dataQuality']['confidenceScore']}")
        
    except Exception as e:
        print(f"Error computing analytics: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()