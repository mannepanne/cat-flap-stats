# Project Title: Cat Flap Stats Data Processor
- Last updated: 2025-06-21
- Updated by: Magnus

### Related documents and resources
- [Sample PDF files for analysis](../SAMPLEDATA/)
- [Project development guidelines](../CLAUDE.md)

## Executive summary
A Python-based data extraction tool that scrapes cat flap usage statistics from SURE Petcare PDF reports, processes and concatenates the data for analysis, enabling personal insights into pet behavior patterns and seasonal trends. The tool will transform weekly PDF reports into consolidated datasets suitable for analysis in PowerBI, Tableau, or similar visualization platforms.

## Description: What is this about?
Creating a personal data processing pipeline to extract cat flap usage data from weekly PDF reports, transform it into analyzable format, and enable comprehensive historical analysis of Sven's behavior patterns including seasonal and routine changes. The project focuses on liberating data trapped in individual PDF files and making it accessible for trend analysis and pattern discovery.

## Problem: What problem is this addressing?
Pet owners cannot effectively analyze long-term cat flap usage patterns due to data being trapped in individual PDF files with no aggregation capabilities.

**Pain points:**
- Weekly manual PDF downloads with data scattered across 50+ files
- No way to analyze trends over full date range
- Inability to identify seasonal or behavioral patterns
- Inherent data gaps from alternative entry/exit methods
- Data stored in unusable format for analysis

**Problem statement:**
I am Sven's human. I am trying to understand and analyze my cat's outdoor activity patterns over time. But I cannot access meaningful analytics because the SURE Petcare app only provides weekly PDF exports with no aggregation or analysis tools, which makes me feel frustrated that we have all this data but can't make good use of it.

## Why: How do we know this is a real problem and worth solving?
Personal frustration with valuable data being inaccessible for analysis, desire to understand seasonal patterns and routine changes in pet behavior, year's worth of data represents significant investment in data collection that's currently unusable. The consistent weekly data collection over approximately one year demonstrates commitment to tracking, but the current format prevents any meaningful longitudinal analysis.

## Audience: Who are we building for?
Magnus and Wendy as primary personal users, not intended for broader distribution or commercial use. This is a personal tool to solve a specific household data analysis need.

## Success: What does the ideal outcome look like?
A consolidated dataset spanning the full date range that can be imported into PowerBI, Tableau, or other analysis tools for pattern discovery and visualization, enabling month-on-month and season-on-season comparisons.

**Goals:**
- Phase 1: Reliable PDF data extraction and concatenation into analyzable format with proper handling of data gaps
- Phase 2: Explore dashboard options using PowerBI/Tableau for seasonal and routine pattern analysis

**Non goals / not in scope:**
- Custom dashboard development in initial phase
- Distribution to other users
- Perfect data completeness (gaps are expected and acceptable)
- Alternative data entry methods

## Key metrics: How do we know we achieved the outcome?
Successful extraction validated against 'golden weeks' with known exact data, expectation of at least one entry/exit per day in winter months (with some exceptions), higher accuracy expected in winter data vs summer data due to reduced back door usage.

**User metrics:**
- Data completeness rate
- Successful PDF processing rate
- Validation accuracy against golden weeks

**Business metrics:**
Not applicable - personal tool

**Technical metrics:**
- PDF parsing success rate
- Data extraction accuracy
- Processing time per PDF file

## Risks: What can go wrong? What are the potential mitigations?
**What can go wrong:**
- PDF format changes from SURE Petcare
- Corrupt data in PDF files
- PDF parsing failures
- Data extraction errors across different PDF variations

**Mitigations:**
- Build flexible parsing script to handle format variations
- Implement data corruption detection and warnings
- Design modular architecture to accommodate future format changes
- Validate against known good data samples

## How: What is the experiment plan?
Start with sample PDF analysis from SAMPLEDATA folder (mix of summer/winter weeks), focus on extracting the main data table with Date/weekday/time columns that appears last in each PDF, test on golden weeks for validation, then process full dataset of ~50 PDFs. Output both CSV and JSON formats based on user preference.

## When: When does it ship and what are the milestones?
No deadline pressure - evening and weekend development schedule.

**Project estimate:**
Leisurely development over several weeks/months

**Team size & composition:**
Solo developer effort (Claude) with Magnus providing feedback, testing, and system configuration support

**Suggested phases:**
- Phase 1: Environment setup and PDF analysis
- Phase 2: Data extraction and processing
- Phase 3: Data validation and output formatting
- Phase 4: Dashboard exploration

**Key milestones:**
1. Set up PDF reading tools and environment
2. Data structure analysis and extraction prototype
3. Full dataset processing and validation
4. Dashboard exploration with PowerBI/Tableau

## Recommendation: Where do we go next?
Complete PRD documentation, then proceed to set up PDF reading tools and begin data structure analysis using sample PDFs.

## Questions: Any known unknowns?
- What specific Python PDF libraries work best for this format?
- What's the exact structure of the data tables?
- Are there any summary statistics in the PDFs worth extracting beyond the daily entry/exit times?
- Python PDF library selection and installation requirements
- System environment setup for PDF processing tools

## User story narrative

**< user_story >**
- ID: US-001
- Title: Process single PDF file
- Description: As a user, I want to process a single PDF file to extract cat flap usage data so that I can verify the extraction works correctly before processing multiple files
- Acceptance criteria: Script accepts single PDF file path, extracts entry/exit data, outputs structured data in CSV/JSON format, handles corrupted data with warnings
**</user_story >**

**< user_story >**
- ID: US-002
- Title: Batch process multiple PDF files
- Description: As a user, I want to process multiple PDF files in a directory so that I can extract data from my entire collection of weekly reports
- Acceptance criteria: Script processes all PDF files in specified directory, combines data chronologically, handles missing files gracefully, provides progress feedback
**</user_story >**

**< user_story >**
- ID: US-003
- Title: Choose output format
- Description: As a user, I want to choose between CSV and JSON output formats so that I can use the data with different analysis tools
- Acceptance criteria: Command line option to specify output format, both formats contain identical data structure, files saved with appropriate extensions
**</user_story >**

**< user_story >**
- ID: US-004
- Title: Validate extracted data
- Description: As a user, I want to validate extracted data against known golden weeks so that I can trust the accuracy of the extraction process
- Acceptance criteria: Validation mode compares extracted data against expected results, reports discrepancies, provides confidence score
**</user_story >**

**< user_story >**
- ID: US-005
- Title: Handle data corruption warnings
- Description: As a user, I want to be warned when PDF data appears corrupted so that I can take appropriate action with problematic files
- Acceptance criteria: Script detects anomalous data patterns, logs warnings with file names, continues processing other files, provides summary of issues
**</user_story >**

**< user_story >**
- ID: US-006
- Title: Consolidate date ranges
- Description: As a user, I want all extracted data consolidated into a single chronological dataset so that I can analyze patterns across the full time period
- Acceptance criteria: Data sorted by date/time, duplicate entries handled, date ranges clearly identified, gaps in data documented
**</user_story >**

**< user_story >**
- ID: US-007
- Title: Extract additional metadata
- Description: As a user, I want to extract any available summary statistics from PDFs so that I can have additional context for analysis
- Acceptance criteria: Identifies and extracts summary data beyond entry/exit times, includes metadata in output, documents what additional data is available
**</user_story >**

**< user_story >**
- ID: US-008
- Title: Handle format variations
- Description: As a user, I want the tool to handle minor PDF format changes so that it remains functional if SURE Petcare updates their report format
- Acceptance criteria: Flexible parsing handles minor layout changes, logs format differences, maintains backward compatibility, fails gracefully on major changes
**</user_story >**

**< user_story >**
- ID: US-009
- Title: Future - Import to PowerBI
- Description: As a user, I want to easily import the processed data into PowerBI so that I can create visualizations and dashboards
- Acceptance criteria: Data format compatible with PowerBI import, clear documentation for import process, sample dashboard templates provided
**</user_story >**

**< user_story >**
- ID: US-010
- Title: Future - Seasonal pattern analysis
- Description: As a user, I want to view seasonal patterns in the dashboard so that I can understand how Sven's behavior changes throughout the year
- Acceptance criteria: Dashboard shows monthly/seasonal comparisons, outdoor time trends, entry/exit frequency patterns, winter vs summer analysis
**</user_story >**

**< user_story >**
- ID: US-011
- Title: Future - Daily routine visualization
- Description: As a user, I want to see daily routine patterns so that I can understand Sven's typical schedule and identify changes
- Acceptance criteria: Dashboard shows average daily patterns, identifies routine changes, highlights unusual days, time-of-day analysis
**</user_story >**

**< user_story >**
- ID: US-012
- Title: Future - Data quality reporting
- Description: As a user, I want to see data quality metrics in the dashboard so that I can understand the completeness and reliability of the analysis
- Acceptance criteria: Dashboard shows data completeness by time period, identifies gaps, shows confidence levels, validates against known patterns
**</user_story >**