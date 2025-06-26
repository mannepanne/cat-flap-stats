# Cat Flap Stats Software Design Documentation

- Last updated: 2025-06-26
- Updated by: Claude (Magnus collaboration)

## Overview

This document contains technical implementation details, architecture decisions, and development guidelines for the Cat Flap Stats data processing system. The system extracts cat flap usage data from SURE Petcare PDF reports using a robust Python-based extraction pipeline.

## System Architecture

### Core Components

**Phase 1 - Data Processing Pipeline:**
- **PDF Extractor**: Python-based extraction engine (`cat_flap_extractor_v5.py`)
- **Web Interface**: CloudFlare Workers for upload handling
- **Processing Engine**: GitHub Actions for automated data processing
- **Storage**: CloudFlare KV for temporary files, GitHub repository for datasets
- **Notifications**: Email alerts via Resend API

**Phase 2 - Analytics Dashboard:**
- **Frontend**: Enhanced web dashboard with interactive visualizations
- **Data Processing**: Extended Python analytics modules
- **Visualization**: Client-side JavaScript (D3.js/Chart.js)
- **Navigation**: Multi-page dashboard structure

### Technology Stack

#### Development Environment
- **Python**: 3.13 in virtual environment (`venv`)
- **Virtual Environment Location**: `cat-flap-stats/` directory
- **Activation Command**: `source venv/bin/activate` (required before any Python execution)

#### Core Dependencies
- **`pdfplumber`**: Primary PDF extraction library (excellent for structured tables)
- **`pandas`**: Data manipulation and CSV/JSON export
- **`PyPDF2`**: Backup PDF processing if needed
- **`tabula-py`**: Alternative table extraction (not currently used)

#### Testing Framework
- **`pytest`**: Comprehensive test framework for unit, integration, and end-to-end testing
- **`pytest-mock`**: Mock functionality for isolated testing
- **Test Coverage**: 62 tests across multiple test suites with 58% coverage
- **Test Types**: 
  - Unit tests (duration parsing, timestamp analysis)
  - Integration tests (PDF processing, data validation)
  - End-to-end tests (output formats)
  - Regression protection tests

#### Phase 2 Technology Stack
- **CloudFlare Workers**: Web interface, upload handling, basic validation
- **CloudFlare KV Storage**: Dataset hosting, temporary file storage, processing state
- **GitHub Actions**: Python script execution environment, automated workflows
- **GitHub Repository**: Version control for datasets, backup management
- **Webhook Integration**: CloudFlare to GitHub communication for triggering workflows
- **Email Notifications**: Processing status reports and error notifications

## Development Commands

### Environment Setup
```bash
# Activate virtual environment (REQUIRED before any Python execution)
source venv/bin/activate
```

### PDF Processing
```bash
# Run main extractor (robust multi-page support)
python3 cat_flap_extractor_v5.py [pdf_path] [options]

# Output formats and options
python3 cat_flap_extractor_v5.py [pdf_path] --format csv --output filename.csv
python3 cat_flap_extractor_v5.py [pdf_path] --format json --output filename.json
python3 cat_flap_extractor_v5.py [pdf_path] --format both

# Debug extraction with detailed logging
python3 cat_flap_extractor_v5.py [pdf_path] --debug

# Bulk processing directory
python3 cat_flap_extractor_v5.py [directory_path] --format csv
```

### Testing
```bash
# Run comprehensive test suite
python -m pytest test_cat_flap_extractor.py -v

# Run specific test categories
python -m pytest test_cat_flap_extractor.py::TestDurationParsing -v
python -m pytest test_cat_flap_extractor.py::TestIntegrationWithValidationData -v
```

## PDF Extraction System

### Key Features
- **Cross-page table reconstruction**: Handles PDF tables split across multiple pages
- **Arbitrary page break support**: Works regardless of where page breaks occur within data
- **Perfect time-duration pairing**: Maintains alignment even when split by page breaks
- **100% validation accuracy**: Tested against manually corrected reference data
- **Universal PDF compatibility**: Single-page and multi-page PDFs handled seamlessly

### Architecture Decisions

#### PDF Parsing Library Choice
**Selected**: pdfplumber
**Reason**: Superior table structure extraction capabilities, excellent handling of complex layouts

#### Data Processing
**Selected**: pandas
**Reason**: Robust data manipulation and export capabilities, industry standard

#### Output Formats
**Selected**: CSV and JSON
**Reason**: Maximum compatibility with analysis tools, transparent data structure

#### System Architecture
**Selected**: Single-file extractor with modular class structure
**Reason**: Maintainability while keeping deployment simple

## Exit/Entry Time Determination Rules

The system uses mathematically precise rules to determine whether a single timestamp represents an exit or entry time, based on timestamp value, duration, and context clues.

### Rule Classification System

Each outdoor session has:
- **Exit time**: When the cat goes outside through the flap
- **Entry time**: When the cat comes back inside through the flap
- **Duration**: Time spent outside during that session

### Implementation Rules

#### Rule 1: Complete Sessions (Two Timestamps)
If a session has two timestamps with a duration (format: "HH:MM - HH:MM"):
- **First timestamp = EXIT time**
- **Second timestamp = ENTRY time**

Example: `06:01 - 07:39` with duration `01:38 h`
- Exit: 06:01, Entry: 07:39, Duration: 1h 38min

#### Rule 2: Single Timestamp Analysis
For sessions with only one timestamp, use duration analysis to determine the timestamp type.

#### Rule 3: Morning Single Timestamp (Before 12:00) with Short Duration
If timestamp is before 12:00 (midday) AND duration < 12 hours:
- **If duration ≈ time since midnight → ENTRY**
- **Otherwise → EXIT**

Example: `00:21` with duration `21:40 mins`
- 00:21 = 21 minutes after midnight
- Duration = 21 minutes 40 seconds
- Since duration ≈ time since midnight → **ENTRY** (cat was outside overnight, came in at 00:21)

#### Rule 3b: Morning Single Timestamp (Before 12:00) with Long Duration
If timestamp is before 12:00 (midday) AND duration ≥ 12 hours:
- **If duration ≈ time since preceding midnight → ENTRY**
- **If duration ≈ time until following midnight → EXIT**
- **Otherwise → fallback to ENTRY**

#### Rule 4: Afternoon/Evening Single Timestamp (After 12:00) with Short Duration
If timestamp is after 12:00 (midday) AND duration < 12 hours:
- **If duration ≈ time until midnight → EXIT**
- **Otherwise → ENTRY**

#### Rule 4b: Afternoon/Evening Single Timestamp (After 12:00) with Long Duration
If timestamp is after 12:00 (midday) AND duration ≥ 12 hours:
- **If duration ≈ time since preceding midnight → ENTRY**
- **If duration ≈ time until following midnight → EXIT**
- **Otherwise → fallback to EXIT**

#### Rule 5: Cross-Midnight Session Detection
When consecutive days have single timestamps that form overnight sessions:
- **Last timestamp of day + duration ≈ time to midnight = EXIT**
- **First timestamp of next day + duration ≈ time from midnight = ENTRY**

#### Rule 6: Missing Data Handling
If there are gaps in data (missing days/files):
- Cannot determine session continuity across gaps
- Apply rules 3/4/7 to timestamps before/after gaps
- Do not count missing time in duration calculations

#### Rule 7: Fallback Rules (Ambiguous Cases)
When other rules cannot determine timestamp type:
- **Rule 7a**: Morning timestamp (< 12:00) → assume **ENTRY**
- **Rule 7b**: Afternoon/evening timestamp (≥ 12:00) → assume **EXIT**

#### Rule 8: Validation Checks
After extraction:
- **Duration validation**: Sum of session durations should be within ±10 minutes of daily total
- **Session count validation**: Number of complete sessions should be within ±1 of reported daily visits
- **State consistency**: Exit/entry balance should be maintained across days

### Implementation Parameters
- Duration formats supported: "HH:MM h", "MM:SS mins", "SS s"
- Precision tolerance: ±30 minutes for duration matching rules
- Cross-midnight detection: Automatic pairing of compatible timestamps across consecutive days
- Error handling: Graceful degradation with detailed logging for edge cases

## Phase 2 Data Architecture Strategy

### Current Dataset Analysis
- **Size**: 1,572 sessions across 505+ days (manageable in-memory processing)
- **Growth Rate**: ~40-50 sessions per week (predictable, linear growth)
- **5-Year Projection**: ~15,000 sessions (still easily manageable)
- **Storage**: CSV (334KB) + JSON (16KB) - fast download times

### Architecture Decision: Enhanced CSV/JSON vs Database

#### Options Evaluated
- **SQLite/D1 Database**: Rejected due to complexity overhead for current dataset size
- **Pure Client-Side**: Rejected due to repeated computation overhead
- **Hybrid Approach**: Selected for optimal simplicity-to-performance ratio

### Hybrid CSV/JSON Implementation

**Enhanced JSON Structure with Pre-computed Analytics:**

```json
{
  "metadata": {
    "lastUpdated": "2025-06-23T19:00:00Z",
    "totalSessions": 1572,
    "dateRange": "2024-02-05 to 2025-06-22",
    "dataQuality": {
      "completeDays": 485,
      "partialDays": 20,
      "confidenceScore": 0.94
    }
  },
  "precomputed": {
    "dailySummaries": [
      {
        "date": "2024-02-05",
        "sessions": 4,
        "firstExit": "06:01",
        "lastEntry": "22:24",
        "totalOutdoorTime": "05:26",
        "isWeekend": false
      }
    ],
    "peakHours": [
      {"hour": 6, "exitFrequency": 0.45, "entryFrequency": 0.12},
      {"hour": 22, "exitFrequency": 0.15, "entryFrequency": 0.38}
    ],
    "seasonalStats": {
      "spring": {"avgDailySessions": 3.2, "avgFirstExit": "06:15"},
      "summer": {"avgDailySessions": 2.8, "avgFirstExit": "05:45"},
      "autumn": {"avgDailySessions": 3.5, "avgFirstExit": "06:45"},
      "winter": {"avgDailySessions": 3.1, "avgFirstExit": "07:15"}
    },
    "weekdayPatterns": {
      "weekdays": {"avgFirstExit": "06:30", "avgLastEntry": "22:15"},
      "weekends": {"avgFirstExit": "07:00", "avgLastEntry": "22:45"}
    }
  },
  "sessions": [...],     // Full session data for detailed analysis
  "annotations": [...]   // User annotations with date ranges
}
```

### Performance Benefits
- **Actogram Rendering**: Use dailySummaries (~365 records) vs full sessions (1,572 records)
- **Peak Hours Analysis**: Direct lookup from precomputed peakHours array
- **Pattern Detection**: Leverage weekdayPatterns and seasonalStats for instant comparison
- **Incremental Loading**: Load metadata + precomputed first, sessions on-demand

### Data Processing Pipeline
1. **GitHub Actions Enhancement**: Extend existing workflow to compute analytics
2. **Statistical Analysis**: Python scripts generate summaries during PDF processing
3. **JSON Generation**: Export enhanced JSON with precomputed analytics
4. **Client Optimization**: Progressive loading with smart caching strategies

### Architecture Advantages
- ✅ **Simplicity**: No database setup, familiar JSON structures
- ✅ **Transparency**: Raw data remains in version-controlled CSV/JSON
- ✅ **Performance**: Pre-computed analytics eliminate repeated calculations
- ✅ **Cost**: Zero additional hosting costs
- ✅ **Flexibility**: Easy migration to database later if dataset grows significantly
- ✅ **Offline Capability**: Client can cache and work without constant server connection

### Migration Path
If dataset grows beyond ~50,000 sessions or query complexity increases significantly, migration to CloudFlare D1 (SQLite) can be implemented with minimal client-side changes due to JSON API compatibility.

## Phase 2 Technical Implementation Strategy

### Web Dashboard Enhancement
- Extend existing CloudFlare Workers dashboard with new analytics pages
- Client-side JavaScript for interactive visualizations (D3.js/Chart.js)
- Server-side statistical analysis using Python modules
- Real-time data updates when new PDFs are processed

### Navigation Structure
```
Dashboard (current stats) →
├── Patterns (New)
│   ├── Activity Rhythm (Actogram + Peak Hours)
│   ├── Daily Routine (Consistency tracking)
│   └── Seasonal Trends (Long-term patterns)
├── Health Monitoring (New)
│   ├── Anomaly Alerts (Unusual behavior detection)
│   └── Data Quality (Reliability assessment)
├── Annotations (New)
│   └── Event Timeline (Contextual information)
└── Upload (existing functionality)
```

### Data Processing Pipeline Enhancement
- Extend existing GitHub Actions workflow with analytics computation
- Generate statistical summaries alongside CSV/JSON export
- Pre-computed metrics stored for dashboard performance
- Real-time analysis capability for immediate feedback

## Quality Assurance

### Testing Strategy
- **Unit Tests**: Individual function validation
- **Integration Tests**: Component interaction validation
- **End-to-End Tests**: Complete workflow validation
- **Regression Tests**: Critical functionality protection

### Data Validation
- 100% accuracy validated against manually corrected reference data
- Cross-year boundary handling with proper chronological sorting
- Mathematical precision with Rules 3b/4b for long duration scenarios
- Zero data loss with comprehensive error handling

### Production Metrics
- **Total Sessions Processed**: 1,572 validated sessions
- **PDF Reports Processed**: 70+ weekly reports
- **Date Range Coverage**: 505 days (Feb 2024 - Jun 2025)
- **Test Success Rate**: 100% (62/62 tests passing)
- **Processing Time**: Sub-minute processing for typical weekly reports

## Deployment Architecture

### Production System Components
- **Web Interface**: https://cat-flap-stats.herrings.workers.dev
- **Authentication**: Magic link email system using Resend
- **Processing**: Serverless GitHub Actions with Python extractor
- **Storage**: Version-controlled datasets in GitHub repository
- **Notifications**: Email delivery with detailed processing reports

### Security Considerations
- Magic link authentication (no passwords stored)
- CloudFlare and GitHub secrets management
- Secure API token handling
- Session management with automatic expiration
- Version-controlled data with backup protection

## Performance Optimization

### Current Performance Characteristics
- **Dataset Size**: 334KB CSV, 16KB JSON
- **Processing Time**: <60 seconds per PDF
- **Memory Usage**: In-memory processing suitable for current scale
- **Network**: Fast download times for datasets

### Scalability Considerations
- Linear growth projection manageable for 5+ years
- Pre-computed analytics reduce client-side computation
- Progressive loading strategy for enhanced user experience
- Database migration path available if needed