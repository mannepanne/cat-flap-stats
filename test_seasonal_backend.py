#!/usr/bin/env python3
"""
Test script for enhanced seasonal analysis backend logic
Tests the core seasonal categorization and statistics without dependencies
"""

import json
from datetime import datetime
from collections import defaultdict

def test_backend_seasonal_analysis():
    """Test backend seasonal analysis implementation"""
    
    def get_season(date):
        """UK South meteorological seasons"""
        month = date.month
        if month in [12, 1, 2]:
            return 'winter'
        elif month in [3, 4, 5]:
            return 'spring'
        elif month in [6, 7, 8]:
            return 'summer'
        else:
            return 'autumn'
    
    def get_season_year(date):
        """Get season with year for proper tracking"""
        season = get_season(date)
        if season == 'winter':
            if date.month == 12:
                return f"winter-{date.year}-{date.year + 1}"
            else:
                return f"winter-{date.year - 1}-{date.year}"
        else:
            return f"{season}-{date.year}"
    
    def get_season_expected_days(season, year):
        """Expected days in season"""
        if season == 'spring':
            return 92
        elif season == 'summer':
            return 92
        elif season == 'autumn':
            return 91
        else:  # winter
            if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
                return 91
            else:
                return 90
    
    def parse_duration_minutes(duration_str):
        """Parse duration to minutes"""
        if not duration_str:
            return 0
        try:
            if 'h' in duration_str:
                if ':' in duration_str:
                    parts = duration_str.replace(' h', '').split(':')
                    hours = float(parts[0])
                    minutes = float(parts[1]) if len(parts) > 1 else 0
                    return hours * 60 + minutes
                else:
                    return float(duration_str.replace(' h', '')) * 60
            elif 'mins' in duration_str:
                parts = duration_str.replace(' mins', '').split(':')
                return float(parts[0]) + (float(parts[1]) / 60 if len(parts) > 1 else 0)
            else:
                return 0
        except:
            return 0
    
    # Load data from CSV for testing
    try:
        print("Testing Enhanced Seasonal Analysis Backend")
        print("=" * 50)
        
        # Read master dataset CSV
        sessions = []
        with open('master_dataset.csv', 'r') as f:
            lines = f.readlines()
            header = lines[0].strip().split(',')
            
            for line in lines[1:]:
                values = line.strip().split(',')
                session = dict(zip(header, values))
                if session.get('date_full'):
                    sessions.append(session)
        
        print(f"Loaded {len(sessions)} sessions from CSV")
        
        # Group by season-year and calculate comprehensive stats
        season_year_data = defaultdict(list)
        
        for session in sessions:
            try:
                date = datetime.strptime(session['date_full'], '%Y-%m-%d')
                season_year = get_season_year(date)
                
                duration_minutes = parse_duration_minutes(session.get('duration', ''))
                
                session_data = {
                    'date': date,
                    'duration_minutes': duration_minutes,
                    'exit_time': session.get('exit_time', ''),
                    'entry_time': session.get('entry_time', '')
                }
                
                season_year_data[season_year].append(session_data)
            except:
                continue
        
        # Calculate statistics for each season-year
        print("\nSeason-Year Analysis:")
        print("-" * 30)
        
        for season_year in sorted(season_year_data.keys()):
            sessions_list = season_year_data[season_year]
            season = season_year.split('-')[0]
            year = int(season_year.split('-')[1])
            
            # Calculate metrics
            total_sessions = len(sessions_list)
            
            # Daily aggregations
            daily_data = defaultdict(lambda: {'sessions': 0, 'duration': 0})
            for session in sessions_list:
                date_str = session['date'].strftime('%Y-%m-%d')
                daily_data[date_str]['sessions'] += 1
                daily_data[date_str]['duration'] += session['duration_minutes']
            
            days_with_data = len(daily_data)
            expected_days = get_season_expected_days(season, year)
            completeness = min(days_with_data / expected_days * 100, 100)
            
            # Calculate averages
            avg_daily_sessions = sum(d['sessions'] for d in daily_data.values()) / days_with_data if days_with_data > 0 else 0
            avg_daily_duration = sum(d['duration'] for d in daily_data.values()) / days_with_data if days_with_data > 0 else 0
            avg_session_duration = sum(s['duration_minutes'] for s in sessions_list) / total_sessions if total_sessions > 0 else 0
            
            # Confidence level
            if completeness >= 75:
                confidence = 'HIGH'
            elif completeness >= 60:
                confidence = 'MEDIUM'
            elif completeness >= 30:
                confidence = 'LOW'
            else:
                confidence = 'VERY_LOW'
            
            print(f"{season_year}:")
            print(f"  Sessions: {total_sessions}")
            print(f"  Days with data: {days_with_data}/{expected_days} ({completeness:.1f}%)")
            print(f"  Confidence: {confidence}")
            print(f"  Avg daily sessions: {avg_daily_sessions:.2f}")
            print(f"  Avg daily duration: {avg_daily_duration:.1f} minutes")
            print(f"  Avg session duration: {avg_session_duration:.1f} minutes")
            print()
        
        # Aggregate by season
        print("Seasonal Aggregation:")
        print("-" * 20)
        
        seasonal_totals = defaultdict(lambda: {
            'total_sessions': 0,
            'daily_durations': [],
            'daily_sessions': [],
            'completeness_scores': []
        })
        
        for season_year, sessions_list in season_year_data.items():
            season = season_year.split('-')[0]
            
            # Daily data for this season-year
            daily_data = defaultdict(lambda: {'sessions': 0, 'duration': 0})
            for session in sessions_list:
                date_str = session['date'].strftime('%Y-%m-%d')
                daily_data[date_str]['sessions'] += 1
                daily_data[date_str]['duration'] += session['duration_minutes']
            
            # Add to seasonal totals
            seasonal_totals[season]['total_sessions'] += len(sessions_list)
            seasonal_totals[season]['daily_durations'].extend([d['duration'] for d in daily_data.values()])
            seasonal_totals[season]['daily_sessions'].extend([d['sessions'] for d in daily_data.values()])
            
            # Calculate completeness for this instance
            year = int(season_year.split('-')[1])
            expected_days = get_season_expected_days(season, year)
            completeness = min(len(daily_data) / expected_days * 100, 100)
            seasonal_totals[season]['completeness_scores'].append(completeness)
        
        # Print seasonal summary
        for season in ['spring', 'summer', 'autumn', 'winter']:
            if season in seasonal_totals:
                data = seasonal_totals[season]
                
                avg_daily_duration = sum(data['daily_durations']) / len(data['daily_durations']) if data['daily_durations'] else 0
                avg_daily_sessions = sum(data['daily_sessions']) / len(data['daily_sessions']) if data['daily_sessions'] else 0
                avg_completeness = sum(data['completeness_scores']) / len(data['completeness_scores']) if data['completeness_scores'] else 0
                
                print(f"{season.upper()}:")
                print(f"  Total sessions: {data['total_sessions']}")
                print(f"  Avg daily duration: {avg_daily_duration:.1f} minutes")
                print(f"  Avg daily sessions: {avg_daily_sessions:.2f}")
                print(f"  Avg completeness: {avg_completeness:.1f}%")
                print()
        
        # Test hypothesis: Summer vs Winter duration comparison
        if 'summer' in seasonal_totals and 'winter' in seasonal_totals:
            summer_avg = sum(seasonal_totals['summer']['daily_durations']) / len(seasonal_totals['summer']['daily_durations'])
            winter_avg = sum(seasonal_totals['winter']['daily_durations']) / len(seasonal_totals['winter']['daily_durations'])
            
            print("HYPOTHESIS TEST:")
            print(f"Summer avg daily duration: {summer_avg:.1f} minutes")
            print(f"Winter avg daily duration: {winter_avg:.1f} minutes")
            print(f"Difference: {summer_avg - winter_avg:.1f} minutes")
            print(f"Hypothesis {'SUPPORTED' if summer_avg > winter_avg else 'NOT SUPPORTED'}: Summer sessions longer than winter")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_backend_seasonal_analysis()