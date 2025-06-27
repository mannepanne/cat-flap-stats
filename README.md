![ScreenShot](https://github.com/mannepanne/cat-flap-stats/blob/main/favicons/scr_circadian.png?raw=true)

# Cat Flap Stats Data Processor

## 🎉 Version 1.0 Complete - Production-Ready System

A complete automated pipeline for processing cat flap usage statistics from SURE Petcare PDF reports. **V1.0 milestone achieved** with production-ready web interface, serverless processing, and comprehensive test coverage providing robust data extraction and basic web dashboard capabilities.

## 🌟 Live Production System

**Web Interface:** https://cat-flap-stats.herrings.workers.dev
- Upload PDFs through secure web interface
- Magic link authentication (magnus.hultberg@gmail.com, hellowendy.wong@gmail.com)
- Automated processing with email notifications

## Project Structure

```
cat-flap-stats/
├── README.md                           # This file
├── CLAUDE.md                          # Claude Code project guidelines
├── requirements.txt                   # Python dependencies
├── cat_flap_extractor_v5.py          # Main production extractor
├── test_cat_flap_extractor.py        # Comprehensive test suite
├── master_dataset.csv                 # Live master dataset (auto-updated)
├── master_dataset.json                # Live master dataset (JSON format)
├── processing_report.md               # Latest processing report
├── duplicate_report.txt               # Duplicate detection report
├── .gitignore                         # Git ignore rules
├── .github/
│   ├── workflows/
│   │   └── process-pdf.yml            # GitHub Actions processing pipeline
│   └── scripts/
│       └── merge_datasets.py          # Dataset merging with duplicate detection
├── cloudflare-workers/                # Web interface (CloudFlare Workers)
│   ├── index.js                       # Main worker script
│   ├── wrangler.toml                  # CloudFlare configuration
│   ├── package.json                   # Dependencies
│   └── README.md                      # Deployment guide
├── dataset_backups/                   # Timestamped dataset backups
├── SPECIFICATIONS/                    # Project documentation
│   └── OnePagerRequirements.md
├── SAMPLEDATA/                        # Sample PDF files for testing
├── SAMPLE_TESTDATA/                   # Test data PDFs (gitignored)
├── SAMPLE_VALIDATIONDATA/             # Validation data and golden datasets (gitignored)
├── BULK_PRODUCTIONDATA/              # Full production PDF collection (gitignored)
├── temp_outputs/                     # Generated CSV/JSON outputs (gitignored)
├── debug_scripts/                    # Debug and development scripts (gitignored)
├── archive/                          # Older extractor versions (gitignored)
└── venv/                            # Python virtual environment (gitignored)
```

## 🚀 Using the Production System

### For Regular Use (Recommended)
1. **Visit:** https://cat-flap-stats.herrings.workers.dev
2. **Login** with your authorized email address
3. **Upload** your weekly SURE Petcare PDF report
4. **Receive email** notification when processing completes
5. **Download** updated datasets from the repository

### For Development/Testing
1. **Setup Environment**
   ```bash
   # Activate virtual environment (REQUIRED)
   source venv/bin/activate

   # Install dependencies if needed
   pip install -r requirements.txt
   ```

2. **Extract Data from Single PDF**
   ```bash
   python3 cat_flap_extractor_v5.py path/to/report.pdf --format csv
   ```

3. **Process Multiple PDFs**
   ```bash
   python3 cat_flap_extractor_v5.py BULK_PRODUCTIONDATA/ --format both
   ```

4. **Run Tests**
   ```bash
   python -m pytest test_cat_flap_extractor.py -v
   ```

## 🌟 Key Features

### Automated End-to-End Pipeline
- **🎯 Complete automation**: Upload PDF → Process → Update dataset → Email notification
- **🌐 Web-based interface**: No local software required - works from any device
- **🔄 Intelligent duplicate detection**: Safe to re-upload files without data corruption
- **💾 Version-controlled datasets**: All changes tracked in Git with automatic backups
- **📧 Processing notifications**: Detailed email reports with statistics and results
- **🛡️ Data integrity**: Automatic backups before every update
- **🔧 Edge case handling**: Gracefully processes PDFs with no cat flap usage data

### Advanced PDF Processing
- **📑 Multi-page PDF processing**: Handles complex layouts with table spans across pages
- **🧮 Mathematically precise extraction**: Exit/entry time determination using duration analysis
- **🌙 Cross-midnight session detection**: Automatically pairs overnight sessions
- **✅ Robust validation**: 100% accuracy against manually corrected reference data
- **📊 Multiple output formats**: CSV and JSON maintained simultaneously
- **🧪 Comprehensive testing**: 62 tests with 58% coverage including regression protection
- **📭 Empty period handling**: Processes PDFs with no usage data (inactive weeks/periods)

### Serverless Architecture
- **☁️ CloudFlare Workers**: Fast, global web interface with KV storage
- **🚀 GitHub Actions**: Serverless Python processing with zero infrastructure
- **🔧 Webhook integration**: Real-time communication between components
- **💰 Cost-effective**: Uses free tiers of CloudFlare and GitHub
- **🔐 Secure authentication**: Magic link system with no passwords required

## 🛠️ Technology Stack

### Backend Processing
- **Python 3.13** with virtual environment
- **pdfplumber**: PDF table extraction and multi-page handling
- **pandas**: Data manipulation, duplicate detection, and export
- **pytest**: Testing framework with comprehensive coverage

### Web Infrastructure
- **CloudFlare Workers**: Serverless JavaScript runtime for web interface
- **CloudFlare KV**: Key-value storage for temporary files and sessions
- **Resend**: Email service for magic link authentication and notifications
- **GitHub Actions**: Serverless CI/CD for automated PDF processing

### Data Storage
- **GitHub Repository**: Version-controlled master datasets with full history
- **CSV & JSON**: Dual format support for maximum compatibility
- **Automatic backups**: Timestamped snapshots in `dataset_backups/`

## Output Data

Each extracted session includes:
- Date and session number
- Exit time, entry time, duration
- Daily totals (PDF-reported and calculated)
- Pet information and report metadata

## Documentation

See `SPECIFICATIONS/OnePagerRequirements.md` for comprehensive project documentation including:
- **Phase 2 completion status** with live production system details
- **Architecture documentation** for CloudFlare + GitHub Actions hybrid approach
- **Detailed extraction rules** and mathematically precise algorithms
- **User stories and acceptance criteria** - all Phase 1 & 2 stories complete
- **Technology decisions** and development environment setup
- **Exit/entry time determination rules** with cross-midnight session handling

## Testing

The project includes comprehensive test coverage (62 tests, 58% coverage):
- **Unit tests**: Duration parsing, timestamp analysis, cross-year boundary detection
- **Integration tests**: PDF processing, data validation, chronological sorting
- **End-to-end tests**: Output format consistency, CSV/JSON alignment
- **Regression protection**: Critical function validation, Rules 3b/4b mathematical logic
- **Production validation**: End-to-end pipeline testing with real PDFs

Run all tests with coverage:
```bash
python -m pytest --cov=. --cov-report=term-missing -v
```

Run specific test categories:
```bash
python -m pytest test_cat_flap_extractor.py::TestDurationParsing -v
python -m pytest test_critical_functionality.py::TestRules3bAnd4bLongDuration -v
python -m pytest test_merge_datasets.py -v
python -m pytest test_backup_system.py -v
```

## Production System Status

**🎉 Version 1.0 Complete - Major Milestone Achieved!**

**✅ Phase 1 Complete**: Robust PDF extractor with comprehensive testing framework
**✅ Phase 2 Complete**: Fully automated incremental dataset updates
**✅ V1.0 Release**: Production-ready system with robust data extraction and basic web dashboard

### V1.0 Achievements:
- **1,572 validated cat flap sessions** across 70+ PDF reports (2024-02-05 to 2025-06-22)
- **Comprehensive test suite**: 62 tests with 58% coverage including regression protection
- **Mathematical precision**: Rules 3b/4b for long duration scenarios with ±30min tolerance
- **Cross-year boundary handling**: Proper chronological sorting across year transitions
- **Production email notifications**: Detailed processing reports with statistics
- **Robust error handling**: Graceful degradation and comprehensive logging
- **Zero data loss**: Backup system with automated cleanup and duplicate detection

**Tag:** `v1.0` - Stable baseline for future development

**Next Phase Recommendation**: Advanced analytics and visualization dashboard (PowerBI/Tableau integration)

---

*For detailed project status, architecture decisions, and user story completion status, see the comprehensive PRD at `SPECIFICATIONS/OnePagerRequirements.md`*
