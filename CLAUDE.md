# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules of Engagement

Immediately after reading this file (CLAUDE.md) always read the file .claude/CLAUDE.md and adhere to the collaboration principles and ways of working listed there.

## Project Overview

Cat Flap Stats is a behavioral analytics platform that extracts and analyzes cat flap usage data from SURE Petcare PDF reports. The system comprises:

- **Python extraction engine** (`cat_flap_extractor_v5.py`) - PDF processing and data extraction
- **CloudFlare Workers web interface** (`cloudflare-workers/`) - User interface and file upload handling
- **GitHub Actions automation** (`.github/workflows/`) - Serverless processing pipeline
- **Production datasets** (`master_dataset.csv`, `master_dataset.json`) - Live data files

## Development Environment

### Python Setup (Required)
```bash
# Always activate virtual environment first
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Common Development Commands

**Testing:**
```bash
# Run all tests with coverage
python -m pytest test_*.py -v --cov=cat_flap_extractor_v5 --cov-report=term-missing

# Run specific test files
python -m pytest test_cat_flap_extractor.py -v
python -m pytest test_critical_functionality.py -v
python -m pytest test_merge_datasets.py -v

# Run critical function validation
python -c "from cat_flap_extractor_v5 import ProductionCatFlapExtractor; extractor = ProductionCatFlapExtractor(); print('✅ All critical functions verified')"
```

**Data Processing:**
```bash
# Process single PDF file
python3 cat_flap_extractor_v5.py path/to/report.pdf --format csv

# Process multiple PDFs
python3 cat_flap_extractor_v5.py BULK_PRODUCTIONDATA/ --format both

# Process with JSON output
python3 cat_flap_extractor_v5.py path/to/report.pdf --format json
```

**CloudFlare Workers (Web Interface):**
```bash
cd cloudflare-workers/
npm run dev          # Local development
npm run deploy       # Deploy to production
npm run tail         # View logs
```

## Architecture Overview

### Core Components

1. **ProductionCatFlapExtractor** (`cat_flap_extractor_v5.py`):
   - PDF table extraction using pdfplumber
   - Duration-based exit/entry time determination (Rules 3b/4b)
   - Cross-midnight session detection
   - Comprehensive validation and error handling

2. **Web Interface** (`cloudflare-workers/index.js`):
   - Magic link authentication
   - File upload handling via CloudFlare KV storage
   - GitHub Actions webhook triggers
   - Email notifications via Resend

3. **GitHub Actions Pipeline** (`.github/workflows/process-pdf.yml`):
   - Serverless Python processing
   - Dataset merging with duplicate detection
   - Automated commits and notifications

### Data Flow

1. User uploads PDF via web interface
2. File stored in CloudFlare KV with processing metadata
3. GitHub Actions triggered via webhook
4. Python extractor processes PDF
5. Data merged into master datasets with backup
6. User notified via email with processing results

## Key Technical Details

### PDF Processing Rules

- **Rule 3b**: Long duration sessions (>8 hours) with single timestamp assume entry time
- **Rule 4b**: Long duration sessions with exit time determine entry via duration subtraction
- **Cross-midnight detection**: Automatic pairing of overnight sessions
- **Chronological validation**: Ensures proper time ordering across year boundaries

### Data Validation

- 100% accuracy validated against manually corrected reference data
- Comprehensive test suite with 62 tests covering edge cases
- Duplicate detection prevents data corruption on re-uploads
- Automatic backup system with timestamped snapshots

### Error Handling

- Graceful degradation for PDFs with no usage data
- Comprehensive logging and validation warnings
- State issue tracking for behavioral anomalies
- Confidence scoring for extracted data quality

## File Organization

### Key Files
- `cat_flap_extractor_v5.py` - Main production extractor
- `master_dataset.csv` - Live master dataset (CSV format)
- `master_dataset.json` - Live master dataset (JSON format)
- `test_cat_flap_extractor.py` - Primary test suite
- `test_critical_functionality.py` - Critical function validation

### Data Directories
- `SAMPLEDATA/` - Sample PDF files for testing
- `BULK_PRODUCTIONDATA/` - Full production PDF collection (gitignored)
- `dataset_backups/` - Timestamped dataset backups
- `temp_outputs/` - Processing outputs (gitignored)

### Documentation
- `SPECIFICATIONS/OnePagerRequirements.md` - Complete project requirements
- `SPECIFICATIONS/SoftwareDesignDocumentation.md` - Technical architecture
- `README.md` - User-facing documentation

## Testing Requirements

Always run tests before making changes:
```bash
python -m pytest test_*.py -v --cov=cat_flap_extractor_v5 --cov-report=term-missing --cov-fail-under=25
```

Critical functions that must always exist:
- `process_pdf` - Main PDF processing entry point
- `parse_duration_hours` - Duration parsing logic
- `determine_single_timestamp_type` - Rules 3b/4b implementation
- `extract_time_duration_pairs_by_day` - Session extraction
- `build_sessions_with_enhanced_validation` - Data validation
- `save_to_csv` / `save_to_json` - Output generation

## Production Considerations

- **Never commit to main without tests passing**
- **Always activate virtual environment** (`source venv/bin/activate`)
- **Backup system is automatic** - master datasets are backed up before any changes
- **Web interface is live** - changes to CloudFlare Workers affect production immediately
- **Email notifications are sent** - test changes carefully to avoid spamming users
