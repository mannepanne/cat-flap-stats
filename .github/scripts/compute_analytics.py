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
        """Initialize with existing dataset JSON (supports both raw and enhanced formats)"""
        with open(json_path, 'r') as f:
            self.data = json.load(f)
        
        # Flatten session data for analysis
        self.sessions = []
        
        # Check if this is the enhanced format with metadata/precomputed
        if isinstance(self.data, dict) and 'precomputed' in self.data:
            print("Enhanced format detected, using raw data file for detailed analysis...")
            # Try to find the raw data file
            raw_file = json_path.replace('master_dataset.json', 'full_production_dataset.json')
            try:
                with open(raw_file, 'r') as f:
                    raw_data = json.load(f)
                self._extract_sessions(raw_data)
            except FileNotFoundError:
                print(f"Raw data file {raw_file} not found, using CSV...")
                csv_file = json_path.replace('.json', '.csv')
                try:
                    import pandas as pd
                    df = pd.read_csv(csv_file)
                    # Convert CSV back to session format for analysis
                    for _, row in df.iterrows():
                        session = {
                            'date_full': row['date_full'],
                            'exit_time': row.get('exit_time', ''),
                            'entry_time': row.get('entry_time', ''),
                            'duration': row.get('duration', ''),
                            'pet_name': row.get('pet_name', 'Sven')
                        }
                        self.sessions.append(session)
                except Exception as e:
                    print(f"Could not load CSV: {e}")
                    return
        else:
            # Original format
            self._extract_sessions(self.data)
        
        print(f"Loaded {len(self.sessions)} sessions for analysis")
        
        # Create DataFrame for analysis
        self._setup_dataframe()
    
    def _extract_sessions(self, data):
        """Extract sessions from raw data format"""
        for report in data:
            if 'session_data' in report:
                for session in report['session_data']:
                    session_copy = session.copy()
                    session_copy['report_date'] = report['report_info']['report_date']
                    self.sessions.append(session_copy)
    
    def _setup_dataframe(self):
        """Setup pandas DataFrame with helper columns"""
        try:
            import pandas as pd
        except ImportError:
            print("pandas not available, skipping DataFrame setup")
            self.df = None
            return
            
        self.df = pd.DataFrame(self.sessions)
        if not self.df.empty:
            self.df['date_full'] = pd.to_datetime(self.df['date_full'])
            # Add helper columns
            self.df['weekday'] = self.df['date_full'].dt.day_name()
            self.df['is_weekend'] = self.df['date_full'].dt.dayofweek >= 5
            self.df['season'] = self.df['date_full'].apply(self._get_season)
            self.df['season_year'] = self.df['date_full'].apply(self._get_season_year)
            self.df['hour_exit'] = self.df['exit_time'].apply(self._time_to_hour)
            self.df['hour_entry'] = self.df['entry_time'].apply(self._time_to_hour)
            self.df['duration_minutes'] = self.df['duration'].apply(self._parse_duration)
    
    def _get_season(self, date):
        """Determine season based on UK South meteorological seasons"""
        month = date.month
        if month in [12, 1, 2]:
            return 'winter'
        elif month in [3, 4, 5]:
            return 'spring'
        elif month in [6, 7, 8]:
            return 'summer'
        else:  # [9, 10, 11]
            return 'autumn'
    
    def _get_season_year(self, date):
        """Get season with year for proper seasonal comparisons"""
        season = self._get_season(date)
        # Winter spans across calendar years, use the year of January/February
        if season == 'winter':
            if date.month == 12:
                return f"winter-{date.year}-{date.year + 1}"
            else:  # Jan or Feb
                return f"winter-{date.year - 1}-{date.year}"
        else:
            return f"{season}-{date.year}"
    
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
        """Compute comprehensive seasonal behavioral statistics"""
        if self.df.empty:
            return {}
        
        try:
            from scipy import stats
            scipy_available = True
        except ImportError:
            print("Warning: scipy not available, statistical tests will be skipped")
            scipy_available = False
        
        seasonal_data = {}
        all_seasons = ['spring', 'summer', 'autumn', 'winter']
        
        # Get seasonal summaries by season-year for proper tracking
        season_year_summaries = {}
        for season_year, group in self.df.groupby('season_year'):
            season = season_year.split('-')[0]
            season_year_summaries[season_year] = self._compute_season_summary(group, season_year)
        
        # Aggregate by season across all years
        for season in all_seasons:
            season_df = self.df[self.df['season'] == season]
            if season_df.empty:
                seasonal_data[season] = self._empty_season_data(season)
                continue
            
            # Get all season-year instances for this season
            season_years = [sy for sy in season_year_summaries.keys() if sy.startswith(season)]
            season_year_data = [season_year_summaries[sy] for sy in season_years]
            
            # Calculate comprehensive statistics
            seasonal_data[season] = self._calculate_seasonal_statistics(
                season_df, season_year_data, season, season_years
            )
        
        # Add statistical comparisons between seasons
        if scipy_available:
            seasonal_data['comparisons'] = self._compute_seasonal_comparisons(seasonal_data)
        else:
            seasonal_data['comparisons'] = {'note': 'Statistical comparisons require scipy package'}
        
        return seasonal_data
    
    def _compute_season_summary(self, season_df, season_year):
        """Compute summary statistics for a specific season-year"""
        if season_df.empty:
            return None
        
        # Date range and completeness
        start_date = season_df['date_full'].min()
        end_date = season_df['date_full'].max()
        days_with_data = len(season_df['date_full'].unique())
        
        # Expected days in season
        season_name = season_year.split('-')[0]
        expected_days = self._get_season_expected_days(season_name, start_date.year)
        completeness = min(days_with_data / expected_days * 100, 100)
        
        # Daily aggregations
        daily_sessions = season_df.groupby('date_full').agg({
            'duration_minutes': 'sum',  # total outdoor time per day
            'date_full': 'count'        # session count per day
        }).rename(columns={'date_full': 'session_count'})
        
        # Core metrics
        avg_daily_sessions = daily_sessions['session_count'].mean()
        avg_daily_duration = daily_sessions['duration_minutes'].mean()
        avg_session_duration = season_df['duration_minutes'].mean()
        
        return {
            'season_year': season_year,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'days_with_data': days_with_data,
            'expected_days': expected_days,
            'completeness_percent': round(completeness, 1),
            'avg_daily_sessions': round(avg_daily_sessions, 2),
            'avg_daily_duration_minutes': round(avg_daily_duration, 1),
            'avg_session_duration_minutes': round(avg_session_duration, 1),
            'total_sessions': len(season_df)
        }
    
    def _calculate_seasonal_statistics(self, season_df, season_year_data, season, season_years):
        """Calculate comprehensive statistics for a season across all years"""
        valid_data = [d for d in season_year_data if d is not None]
        
        if not valid_data:
            return self._empty_season_data(season)
        
        # Aggregate metrics across all instances of this season
        total_sessions = sum(d['total_sessions'] for d in valid_data)
        avg_completeness = np.mean([d['completeness_percent'] for d in valid_data])
        
        # Session frequency analysis
        daily_sessions = season_df.groupby('date_full').size()
        
        # Duration analysis (our primary hypothesis)
        daily_durations = season_df.groupby('date_full')['duration_minutes'].sum()
        session_durations = season_df['duration_minutes']
        
        # Timing analysis
        first_exits, last_entries = self._extract_daily_timings(season_df)
        
        return {
            'season': season,
            'season_years': season_years,
            'data_quality': {
                'completeness_percent': round(avg_completeness, 1),
                'confidence_level': self._get_confidence_level(avg_completeness),
                'total_days': len(daily_sessions),
                'expected_days_range': f"{min(d['expected_days'] for d in valid_data)}-{max(d['expected_days'] for d in valid_data)}"
            },
            'frequency_metrics': {
                'avg_daily_sessions': round(daily_sessions.mean(), 2),
                'median_daily_sessions': round(daily_sessions.median(), 1),
                'std_daily_sessions': round(daily_sessions.std(), 2),
                'total_sessions': total_sessions
            },
            'duration_metrics': {
                'avg_daily_duration_minutes': round(daily_durations.mean(), 1),
                'median_daily_duration_minutes': round(daily_durations.median(), 1),
                'avg_session_duration_minutes': round(session_durations.mean(), 1),
                'median_session_duration_minutes': round(session_durations.median(), 1),
                'std_session_duration_minutes': round(session_durations.std(), 2)
            },
            'timing_metrics': {
                'avg_first_exit': self._minutes_to_time(np.mean(first_exits)) if first_exits else None,
                'avg_last_entry': self._minutes_to_time(np.mean(last_entries)) if last_entries else None,
                'std_first_exit_minutes': round(np.std(first_exits), 1) if first_exits else None
            },
            'instances': valid_data
        }
    
    def _compute_seasonal_comparisons(self, seasonal_data):
        """Compute statistical comparisons between seasons"""
        from scipy import stats
        
        comparisons = {}
        seasons = ['spring', 'summer', 'autumn', 'winter']
        
        # Duration comparison (primary hypothesis)
        duration_data = {}
        frequency_data = {}
        
        for season in seasons:
            if season in seasonal_data and 'instances' in seasonal_data[season]:
                duration_data[season] = [d['avg_daily_duration_minutes'] for d in seasonal_data[season]['instances'] if d]
                frequency_data[season] = [d['avg_daily_sessions'] for d in seasonal_data[season]['instances'] if d]
        
        # Statistical tests for duration differences
        comparisons['duration_analysis'] = self._perform_anova_analysis(duration_data, 'daily_duration_minutes')
        comparisons['frequency_analysis'] = self._perform_anova_analysis(frequency_data, 'daily_sessions')
        
        # Pairwise comparisons for key hypotheses
        if 'summer' in duration_data and 'winter' in duration_data:
            summer_winter_p = self._ttest_comparison(duration_data['summer'], duration_data['winter'])
            comparisons['summer_winter_duration'] = {
                'hypothesis': 'Summer sessions are longer than winter sessions',
                'p_value': summer_winter_p,
                'significant': summer_winter_p < 0.05,
                'effect_size': self._calculate_effect_size(duration_data['summer'], duration_data['winter'])
            }
        
        return comparisons
    
    def _perform_anova_analysis(self, season_data, metric_name):
        """Perform one-way ANOVA analysis across seasons"""
        from scipy import stats
        
        # Filter seasons with sufficient data
        valid_seasons = {k: v for k, v in season_data.items() if len(v) >= 2}
        
        if len(valid_seasons) < 2:
            return {'error': 'Insufficient data for statistical analysis'}
        
        try:
            values = list(valid_seasons.values())
            f_stat, p_value = stats.f_oneway(*values)
            
            return {
                'metric': metric_name,
                'seasons_compared': list(valid_seasons.keys()),
                'f_statistic': round(f_stat, 4),
                'p_value': round(p_value, 6),
                'significant': p_value < 0.05,
                'interpretation': 'Significant seasonal differences detected' if p_value < 0.05 else 'No significant seasonal differences'
            }
        except Exception as e:
            return {'error': f'Statistical analysis failed: {str(e)}'}
    
    def _ttest_comparison(self, group1, group2):
        """Perform independent t-test between two groups"""
        from scipy import stats
        
        if len(group1) < 2 or len(group2) < 2:
            return 1.0
        
        try:
            _, p_value = stats.ttest_ind(group1, group2)
            return p_value
        except:
            return 1.0
    
    def _calculate_effect_size(self, group1, group2):
        """Calculate Cohen's d effect size"""
        if len(group1) < 2 or len(group2) < 2:
            return 0.0
        
        try:
            pooled_std = np.sqrt(((len(group1) - 1) * np.var(group1) + (len(group2) - 1) * np.var(group2)) / (len(group1) + len(group2) - 2))
            if pooled_std == 0:
                return 0.0
            return (np.mean(group1) - np.mean(group2)) / pooled_std
        except:
            return 0.0
    
    def _get_season_expected_days(self, season, year):
        """Get expected number of days in a season for the given year"""
        if season == 'spring':  # Mar-May
            return 92  # 31 + 30 + 31
        elif season == 'summer':  # Jun-Aug
            return 92  # 30 + 31 + 31
        elif season == 'autumn':  # Sep-Nov
            return 91  # 30 + 31 + 30
        else:  # winter: Dec-Feb
            # Check if leap year affects February
            if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
                return 91  # 31 + 29 + 31
            else:
                return 90  # 31 + 28 + 31
    
    def _get_confidence_level(self, completeness_percent):
        """Get confidence level based on data completeness"""
        if completeness_percent >= 75:
            return 'high'
        elif completeness_percent >= 60:
            return 'medium'
        elif completeness_percent >= 30:
            return 'low'
        else:
            return 'very_low'
    
    def _extract_daily_timings(self, season_df):
        """Extract first exit and last entry times for timing analysis"""
        first_exits = []
        last_entries = []
        
        for date, group in season_df.groupby('date_full'):
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
        
        return first_exits, last_entries
    
    def _minutes_to_time(self, minutes):
        """Convert minutes since midnight to HH:MM format"""
        if pd.isna(minutes):
            return None
        return f"{int(minutes // 60):02d}:{int(minutes % 60):02d}"
    
    def _empty_season_data(self, season):
        """Return empty data structure for seasons with no data"""
        return {
            'season': season,
            'season_years': [],
            'data_quality': {
                'completeness_percent': 0,
                'confidence_level': 'no_data',
                'total_days': 0,
                'expected_days_range': '0-0'
            },
            'frequency_metrics': {
                'avg_daily_sessions': 0,
                'median_daily_sessions': 0,
                'std_daily_sessions': 0,
                'total_sessions': 0
            },
            'duration_metrics': {
                'avg_daily_duration_minutes': 0,
                'median_daily_duration_minutes': 0,
                'avg_session_duration_minutes': 0,
                'median_session_duration_minutes': 0,
                'std_session_duration_minutes': 0
            },
            'timing_metrics': {
                'avg_first_exit': None,
                'avg_last_entry': None,
                'std_first_exit_minutes': None
            },
            'instances': []
        }
    
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