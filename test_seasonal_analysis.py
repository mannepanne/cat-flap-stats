#!/usr/bin/env python3
"""
Quick test script for seasonal analysis logic
"""

import json
from datetime import datetime

def get_season(date):
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

def get_season_year(date):
    """Get season with year for proper seasonal comparisons"""
    season = get_season(date)
    # Winter spans across calendar years, use the year of January/February
    if season == 'winter':
        if date.month == 12:
            return f"winter-{date.year}-{date.year + 1}"
        else:  # Jan or Feb
            return f"winter-{date.year - 1}-{date.year}"
    else:
        return f"{season}-{date.year}"

def test_seasonal_logic():
    """Test the seasonal categorization logic"""
    test_dates = [
        "2024-02-15",  # winter 2023-2024
        "2024-03-15",  # spring 2024
        "2024-06-15",  # summer 2024
        "2024-09-15",  # autumn 2024
        "2024-12-15",  # winter 2024-2025
        "2025-01-15",  # winter 2024-2025
        "2025-03-15",  # spring 2025
        "2025-06-15",  # summer 2025 (partial)
    ]
    
    print("Testing seasonal categorization logic:")
    print("=" * 50)
    
    for date_str in test_dates:
        date = datetime.strptime(date_str, '%Y-%m-%d')
        season = get_season(date)
        season_year = get_season_year(date)
        print(f"{date_str} -> {season} -> {season_year}")
    
    print("\nTesting seasonal data loading from master dataset:")
    print("=" * 50)
    
    try:
        with open('master_dataset.json', 'r') as f:
            data = json.load(f)
        
        # Check if this is the new enhanced format
        if 'precomputed' in data and 'dailySummaries' in data['precomputed']:
            daily_summaries = data['precomputed']['dailySummaries']
            print(f"Daily summaries loaded: {len(daily_summaries)}")
            
            # Group by season-year using daily summaries
            season_counts = {}
            for summary in daily_summaries:
                date = datetime.strptime(summary['date'], '%Y-%m-%d')
                season_year = get_season_year(date)
                
                if season_year not in season_counts:
                    season_counts[season_year] = 0
                season_counts[season_year] += summary['sessions']
        else:
            # Old format
            sessions = []
            for report in data:
                if 'session_data' in report:
                    for session in report['session_data']:
                        session_copy = session.copy()
                        session_copy['report_date'] = report['report_info']['report_date']
                        sessions.append(session_copy)
            
            print(f"Total sessions loaded: {len(sessions)}")
            
            # Group by season-year
            season_counts = {}
            for session in sessions:
                date = datetime.strptime(session['date_full'], '%Y-%m-%d')
                season_year = get_season_year(date)
                
                if season_year not in season_counts:
                    season_counts[season_year] = 0
                season_counts[season_year] += 1
        
        print("\nSessions by season-year:")
        for season_year in sorted(season_counts.keys()):
            print(f"  {season_year}: {season_counts[season_year]} sessions")
        
        # Group by season (aggregated across years)
        season_totals = {}
        for season_year, count in season_counts.items():
            season = season_year.split('-')[0]
            if season not in season_totals:
                season_totals[season] = 0
            season_totals[season] += count
        
        print("\nTotal sessions by season:")
        for season in ['spring', 'summer', 'autumn', 'winter']:
            count = season_totals.get(season, 0)
            print(f"  {season}: {count} sessions")
            
    except FileNotFoundError:
        print("master_dataset.json not found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_seasonal_logic()