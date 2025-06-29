#!/usr/bin/env python3
# ABOUT: Extract metrics from processing_report.md and update processing_metrics.json
# ABOUT: Tracks duplicate detection rates, file sizes, session counts, and processing trends over time

import json
import re
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pandas as pd

class ProcessingMetricsExtractor:
    def __init__(self, processing_report_path="processing_report.md", 
                 metrics_file_path="processing_metrics.json",
                 master_dataset_path="master_dataset.csv"):
        self.processing_report_path = processing_report_path
        self.metrics_file_path = metrics_file_path
        self.master_dataset_path = master_dataset_path
        
    def extract_metrics_from_report(self) -> Optional[Dict]:
        """Extract metrics from the current processing_report.md"""
        if not os.path.exists(self.processing_report_path):
            print(f"Processing report not found: {self.processing_report_path}")
            return None
            
        with open(self.processing_report_path, 'r') as f:
            content = f.read()
        
        # Extract timestamp and file info
        date_match = re.search(r'\*\*Date:\*\* (.+)', content)
        file_match = re.search(r'\*\*File:\*\* (.+)', content)
        uploader_match = re.search(r'\*\*Uploaded by:\*\* (.+)', content)
        
        if not all([date_match, file_match, uploader_match]):
            print("Could not extract basic info from processing report")
            return None
        
        # Parse timestamp 
        timestamp_str = date_match.group(1).strip()
        try:
            timestamp = datetime.strptime(timestamp_str, "%a %b %d %H:%M:%S UTC %Y")
            iso_timestamp = timestamp.isoformat() + 'Z'
        except ValueError:
            iso_timestamp = datetime.now().isoformat() + 'Z'
        
        # Extract processing status
        processing_status = "success" if "✅" in content else "failure"
        
        # Extract duplicate detection metrics
        new_sessions = self._extract_number(content, r'New sessions processed: (\d+)')
        duplicate_sessions = self._extract_number(content, r'Duplicate sessions found: (\d+)')
        unique_new_sessions = self._extract_number(content, r'Unique new sessions added: (\d+)')
        total_sessions = self._extract_number(content, r'Total sessions in dataset: (\d+)')
        
        # Calculate duplicate rate
        duplicate_rate = (duplicate_sessions / new_sessions * 100) if new_sessions > 0 else 0
        
        # Extract dataset date range
        date_range_match = re.search(r'Dataset date range: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})', content)
        dataset_date_range = {
            "start": date_range_match.group(1) if date_range_match else None,
            "end": date_range_match.group(2) if date_range_match else None
        }
        
        # Extract file sizes
        new_csv_size = self._extract_number(content, r'New CSV size: (\d+) bytes')
        new_json_size = self._extract_number(content, r'New JSON size: (\d+) bytes')
        master_csv_size = self._extract_number(content, r'Master CSV size: (\d+) bytes')
        master_json_size = self._extract_number(content, r'Master JSON size: (\d+) bytes')
        
        # Calculate dataset growth metrics
        total_days_covered = self._calculate_total_days_covered(dataset_date_range)
        
        # Detect missing weeks
        missing_weeks = self._detect_missing_weeks(content)
        
        return {
            "timestamp": iso_timestamp,
            "filename": file_match.group(1).strip(),
            "uploader": uploader_match.group(1).strip(),
            "processing_status": processing_status,
            "new_sessions_processed": new_sessions,
            "duplicate_sessions_found": duplicate_sessions,
            "unique_new_sessions_added": unique_new_sessions,
            "total_sessions_in_dataset": total_sessions,
            "duplicate_rate_percent": round(duplicate_rate, 2),
            "dataset_date_range": dataset_date_range,
            "file_sizes": {
                "new_csv_bytes": new_csv_size,
                "new_json_bytes": new_json_size,
                "master_csv_bytes": master_csv_size,
                "master_json_bytes": master_json_size
            },
            "dataset_growth": {
                "csv_size_mb": round(master_csv_size / (1024 * 1024), 2),
                "json_size_mb": round(master_json_size / (1024 * 1024), 2),
                "total_days_covered": total_days_covered
            },
            "missing_weeks": missing_weeks
        }
    
    def _extract_number(self, content: str, pattern: str) -> int:
        """Extract a number from content using regex pattern"""
        match = re.search(pattern, content)
        return int(match.group(1)) if match else 0
    
    def _calculate_total_days_covered(self, date_range: Dict) -> int:
        """Calculate total days between start and end dates"""
        if not date_range.get("start") or not date_range.get("end"):
            return 0
        
        try:
            start_date = datetime.strptime(date_range["start"], "%Y-%m-%d")
            end_date = datetime.strptime(date_range["end"], "%Y-%m-%d")
            return (end_date - start_date).days + 1
        except ValueError:
            return 0
    
    def _detect_missing_weeks(self, new_pdf_content: str) -> List[Dict]:
        """Detect missing weeks by comparing master dataset end date with new PDF start date"""
        if not os.path.exists(self.master_dataset_path):
            return []
        
        try:
            # Get the last date from master dataset
            df = pd.read_csv(self.master_dataset_path)
            if 'date_full' not in df.columns or len(df) == 0:
                return []
            
            df['date_full'] = pd.to_datetime(df['date_full'])
            last_dataset_date = df['date_full'].max().date()
            
            # Extract the first date from the new PDF content being processed
            first_new_date = self._extract_first_date_from_new_pdf(new_pdf_content)
            if not first_new_date:
                return []
            
            # Calculate gap between last dataset date and first new PDF date
            gap_days = (first_new_date - last_dataset_date).days - 1  # -1 because we don't count the boundary dates
            
            missing_weeks = []
            if gap_days >= 7:
                # There's a gap of 7+ days - this indicates missing weeks
                gap_start = last_dataset_date + timedelta(days=1)
                gap_end = first_new_date - timedelta(days=1)
                
                missing_weeks.append({
                    "gap_start_date": str(gap_start),
                    "gap_end_date": str(gap_end),
                    "days_missing": gap_days,
                    "weeks_missing": round(gap_days / 7, 1),
                    "description": f"Gap between last dataset date ({last_dataset_date}) and new PDF start date ({first_new_date})"
                })
            
            return missing_weeks
            
        except Exception as e:
            print(f"Error detecting missing weeks: {e}")
            return []
    
    def _extract_first_date_from_new_pdf(self, processing_report_content: str) -> Optional[datetime.date]:
        """Extract the date range from the processing report to get first date of new PDF"""
        try:
            # The processing report contains the filename which has the date
            # e.g., "SvenVarysSootyHultbergWong Activity Report 14-07-2024.pdf"
            file_match = re.search(r'\*\*File:\*\* (.+)', processing_report_content)
            if not file_match:
                return None
            
            filename = file_match.group(1).strip()
            
            # Extract date from filename pattern: DD-MM-YYYY
            date_match = re.search(r'(\d{2}-\d{2}-\d{4})\.pdf', filename)
            if date_match:
                date_str = date_match.group(1)
                # Convert DD-MM-YYYY to YYYY-MM-DD format
                day, month, year = date_str.split('-')
                pdf_end_date = datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d").date()
                
                # PDF reports are weekly, so the start date is 6 days earlier
                pdf_start_date = pdf_end_date - timedelta(days=6)
                return pdf_start_date
            
            return None
            
        except Exception as e:
            print(f"Error extracting first date from new PDF: {e}")
            return None
    
    def load_metrics_file(self) -> Dict:
        """Load existing metrics file or create new structure"""
        if os.path.exists(self.metrics_file_path):
            with open(self.metrics_file_path, 'r') as f:
                return json.load(f)
        else:
            return {
                "metadata": {
                    "created": datetime.now().strftime("%Y-%m-%d"),
                    "description": "Processing metrics trends for PDF upload and processing analysis",
                    "version": "1.0"
                },
                "metrics": [],
                "trends": {
                    "last_updated": datetime.now().strftime("%Y-%m-%d"),
                    "total_processing_runs": 0,
                    "average_duplicate_rate": 0.0,
                    "average_new_sessions_per_upload": 0.0,
                    "dataset_growth_trend": "stable",
                    "processing_success_rate": 100.0
                }
            }
    
    def calculate_trends(self, metrics_data: Dict) -> Dict:
        """Calculate trend statistics from all metrics (excluding historical analysis entries)"""
        all_metrics = metrics_data.get("metrics", [])
        
        # Filter out historical analysis entries for processing statistics
        processing_metrics = [m for m in all_metrics if m.get("type") != "historical_analysis"]
        
        if not processing_metrics:
            return metrics_data.get("trends", {})
        
        total_runs = len(processing_metrics)
        successful_runs = sum(1 for m in processing_metrics if m.get("processing_status") == "success")
        success_rate = (successful_runs / total_runs * 100) if total_runs > 0 else 100.0
        
        duplicate_rates = [m.get("duplicate_rate_percent", 0) for m in processing_metrics]
        avg_duplicate_rate = sum(duplicate_rates) / len(duplicate_rates) if duplicate_rates else 0
        
        new_sessions = [m.get("unique_new_sessions_added", 0) for m in processing_metrics]
        avg_new_sessions = sum(new_sessions) / len(new_sessions) if new_sessions else 0
        
        # Determine dataset growth trend
        if len(processing_metrics) >= 2:
            recent_size = processing_metrics[-1].get("dataset_growth", {}).get("csv_size_mb", 0)
            previous_size = processing_metrics[-2].get("dataset_growth", {}).get("csv_size_mb", 0)
            
            if recent_size > previous_size * 1.1:
                growth_trend = "growing"
            elif recent_size < previous_size * 0.9:
                growth_trend = "shrinking"
            else:
                growth_trend = "stable"
        else:
            growth_trend = "stable"
        
        return {
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "total_processing_runs": total_runs,
            "average_duplicate_rate": round(avg_duplicate_rate, 2),
            "average_new_sessions_per_upload": round(avg_new_sessions, 2),
            "dataset_growth_trend": growth_trend,
            "processing_success_rate": round(success_rate, 2)
        }
    
    def update_metrics_file(self, new_metrics: Dict) -> bool:
        """Update the metrics file with new metrics entry"""
        try:
            metrics_data = self.load_metrics_file()
            
            # Check if this timestamp already exists (avoid duplicates)
            existing_timestamps = {m.get("timestamp") for m in metrics_data.get("metrics", [])}
            if new_metrics.get("timestamp") in existing_timestamps:
                print(f"Metrics for timestamp {new_metrics.get('timestamp')} already exist")
                return False
            
            # Add new metrics
            metrics_data["metrics"].append(new_metrics)
            
            # Update trends
            metrics_data["trends"] = self.calculate_trends(metrics_data)
            
            # Save updated file
            with open(self.metrics_file_path, 'w') as f:
                json.dump(metrics_data, f, indent=2)
            
            print(f"Metrics updated successfully. Total entries: {len(metrics_data['metrics'])}")
            return True
            
        except Exception as e:
            print(f"Error updating metrics file: {e}")
            return False
    
    def run(self) -> bool:
        """Main method to extract and update metrics"""
        print("Extracting metrics from processing report...")
        
        new_metrics = self.extract_metrics_from_report()
        if not new_metrics:
            print("Failed to extract metrics from processing report")
            return False
        
        print(f"Extracted metrics for: {new_metrics['filename']}")
        print(f"New sessions added: {new_metrics['unique_new_sessions_added']}")
        print(f"Duplicate rate: {new_metrics['duplicate_rate_percent']}%")
        print(f"Missing weeks detected: {len(new_metrics['missing_weeks'])}")
        
        success = self.update_metrics_file(new_metrics)
        if success:
            print("Processing metrics updated successfully!")
        
        return success

    def analyze_historical_missing_weeks(self) -> List[Dict]:
        """One-time analysis to find all historical 7-day gaps in the entire dataset"""
        if not os.path.exists(self.master_dataset_path):
            print("Master dataset not found for historical analysis")
            return []
        
        try:
            print("Loading master dataset for historical analysis...")
            df = pd.read_csv(self.master_dataset_path)
            if 'date_full' not in df.columns or len(df) == 0:
                print("No date_full column or empty dataset")
                return []
            
            # Get all unique dates with data, sorted chronologically
            df['date_full'] = pd.to_datetime(df['date_full'])
            unique_dates = sorted(df['date_full'].dt.date.unique())
            
            print(f"Analyzing {len(unique_dates)} unique dates from {unique_dates[0]} to {unique_dates[-1]}")
            
            # Find gaps of 7+ days between consecutive dates with data
            historical_gaps = []
            
            for i in range(1, len(unique_dates)):
                prev_date = unique_dates[i-1]
                curr_date = unique_dates[i]
                gap_days = (curr_date - prev_date).days - 1  # -1 to not count boundary dates
                
                if gap_days >= 7:
                    gap_start = prev_date + timedelta(days=1)
                    gap_end = curr_date - timedelta(days=1)
                    
                    historical_gaps.append({
                        "type": "historical_analysis",
                        "timestamp": f"{curr_date}T00:00:00Z",  # Use the date when data resumed
                        "filename": f"HISTORICAL_GAP_ANALYSIS",
                        "uploader": "system_analysis",
                        "processing_status": "historical_gap_detected",
                        "gap_details": {
                            "gap_start_date": str(gap_start),
                            "gap_end_date": str(gap_end),
                            "days_missing": gap_days,
                            "weeks_missing": round(gap_days / 7, 1),
                            "last_data_date": str(prev_date),
                            "next_data_date": str(curr_date),
                            "description": f"Historical gap: {gap_days} days between {prev_date} and {curr_date}"
                        },
                        "missing_weeks": [{
                            "gap_start_date": str(gap_start),
                            "gap_end_date": str(gap_end),
                            "days_missing": gap_days,
                            "weeks_missing": round(gap_days / 7, 1),
                            "description": f"Historical data collection gap: {gap_days} days"
                        }]
                    })
            
            print(f"Found {len(historical_gaps)} historical gaps of 7+ days")
            for gap in historical_gaps:
                gap_info = gap["gap_details"]
                print(f"  - {gap_info['days_missing']} days ({gap_info['weeks_missing']} weeks) from {gap_info['gap_start_date']} to {gap_info['gap_end_date']}")
            
            return historical_gaps
            
        except Exception as e:
            print(f"Error in historical analysis: {e}")
            return []
    
    def populate_historical_metrics(self) -> bool:
        """Pre-populate processing metrics with historical missing weeks analysis"""
        try:
            print("Running historical missing weeks analysis...")
            historical_gaps = self.analyze_historical_missing_weeks()
            
            if not historical_gaps:
                print("No historical gaps found or analysis failed")
                return False
            
            # Load existing metrics
            metrics_data = self.load_metrics_file()
            
            # Add historical gaps to metrics (but don't duplicate)
            existing_historical = {m.get("timestamp") for m in metrics_data.get("metrics", []) 
                                 if m.get("type") == "historical_analysis"}
            
            added_count = 0
            for gap in historical_gaps:
                if gap["timestamp"] not in existing_historical:
                    metrics_data["metrics"].append(gap)
                    added_count += 1
            
            # Sort metrics by timestamp
            metrics_data["metrics"].sort(key=lambda x: x.get("timestamp", ""))
            
            # Update trends (but exclude historical analysis from processing stats)
            metrics_data["trends"] = self.calculate_trends(metrics_data)
            
            # Save updated metrics
            with open(self.metrics_file_path, 'w') as f:
                json.dump(metrics_data, f, indent=2)
            
            print(f"Added {added_count} historical gap entries to processing metrics")
            print(f"Total metrics entries: {len(metrics_data['metrics'])}")
            
            return True
            
        except Exception as e:
            print(f"Error populating historical metrics: {e}")
            return False

def main():
    import sys
    
    extractor = ProcessingMetricsExtractor()
    
    # Check for historical analysis flag
    if len(sys.argv) > 1 and sys.argv[1] == "--historical":
        print("Running historical missing weeks analysis...")
        extractor.populate_historical_metrics()
    else:
        print("Running standard processing report extraction...")
        extractor.run()

if __name__ == "__main__":
    main()