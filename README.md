# Cat Flap Stats Data Processor

A Python-based data extraction tool that processes cat flap usage statistics from SURE Petcare PDF reports, enabling analysis of pet behavior patterns and seasonal trends.

## Project Structure

```
cat-flap-stats/
├── README.md                           # This file
├── CLAUDE.md                          # Claude Code project guidelines
├── requirements.txt                   # Python dependencies
├── cat_flap_extractor_v5.py          # Main production extractor
├── test_cat_flap_extractor.py        # Comprehensive test suite
├── .gitignore                         # Git ignore rules
├── SPECIFICATIONS/                    # Project documentation
│   └── OnePagerCatFlapStatsDataProcessor.md
├── SAMPLEDATA/                        # Sample PDF files for testing
├── SAMPLE_TESTDATA/                   # Test data PDFs
├── SAMPLE_VALIDATIONDATA/             # Validation data and golden datasets
├── BULK_PRODUCTIONDATA/              # Full production PDF collection
├── temp_outputs/                     # Generated CSV/JSON outputs (gitignored)
├── debug_scripts/                    # Debug and development scripts (gitignored)
├── archive/                          # Older extractor versions (gitignored)
└── venv/                            # Python virtual environment (gitignored)
```

## Quick Start

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

## Features

- **Multi-page PDF processing**: Handles complex PDF layouts with table spans across pages
- **Mathematically precise extraction**: Exit/entry time determination using duration analysis
- **Cross-midnight session detection**: Automatically pairs overnight sessions
- **Robust validation**: 100% accuracy against manually corrected reference data
- **Multiple output formats**: CSV and JSON export options
- **Comprehensive testing**: 21 tests covering unit, integration, and end-to-end scenarios

## Technology Stack

- **Python 3.13** with virtual environment
- **pdfplumber**: PDF table extraction
- **pandas**: Data manipulation and export
- **pytest**: Testing framework with comprehensive coverage

## Output Data

Each extracted session includes:
- Date and session number
- Exit time, entry time, duration
- Daily totals (PDF-reported and calculated)
- Pet information and report metadata

## Documentation

See `SPECIFICATIONS/OnePagerCatFlapStatsDataProcessor.md` for comprehensive project documentation including:
- Detailed extraction rules and algorithms
- User stories and acceptance criteria  
- Technology decisions and architecture
- Development environment setup

## Testing

The project includes comprehensive test coverage:
- **Unit tests**: Duration parsing, timestamp analysis
- **Integration tests**: PDF processing, data validation
- **End-to-end tests**: Output format consistency
- **Regression protection**: Critical function validation

Run specific test categories:
```bash
python -m pytest test_cat_flap_extractor.py::TestDurationParsing -v
python -m pytest test_cat_flap_extractor.py::TestIntegrationWithValidationData -v
```