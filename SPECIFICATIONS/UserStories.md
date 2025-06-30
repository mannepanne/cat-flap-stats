# Cat Flap Stats User Stories

- Last updated: 2025-06-30
- Updated by: Claude (Magnus collaboration)

This document contains all user stories for the Cat Flap Stats project, organized by phase and implementation status.

**IMPORTANT:** When updating this document, whether you are updating existing user stories or adding new ones, never ever change the ID numbering (e.g. US-001) of an existing user story! If you do you will break references from other documents relying on the numbering to stay the same. When adding new user stories, ALWAYS assign an ID number in sequential order incrementally increased from the highest existing ID. You do NOT need to order user stories in this document by ID number order, feel free to order them and organise them under different sub headings in any logical way you see fit if you think it increases readability of the document.

---

## Phase 1: Data Foundation (✅ COMPLETE)

### **US-001** ✅ COMPLETE
**Title:** Extract individual session data from PDF

**Description:** As a user, I want to extract every individual entry/exit session from a PDF (not just daily summaries) so that I can analyze detailed timing patterns and behavior.

**Acceptance Criteria:**
- Script extracts each session with exit time, entry time, duration, session number within day
- Handles single PDFs and directories
- Outputs detailed CSV/JSON

**Status:** COMPLETE - `cat_flap_extractor_v5.py` extracts individual sessions with comprehensive details

---

### **US-002** ✅ COMPLETE
**Title:** Batch process multiple PDF files

**Description:** As a user, I want to process multiple PDF files in a directory so that I can extract data from my entire collection of weekly reports.

**Acceptance Criteria:**
- Script processes all PDF files in specified directory
- Combines data chronologically
- Handles missing files gracefully
- Provides progress feedback

**Status:** COMPLETE - Tested on 21 PDF bulk processing with comprehensive progress feedback

---

### **US-003** ✅ COMPLETE
**Title:** Choose output format

**Description:** As a user, I want to choose between CSV and JSON output formats so that I can use the data with different analysis tools.

**Acceptance Criteria:**
- Command line option to specify output format
- Both formats contain identical data structure
- Files saved with appropriate extensions

**Status:** COMPLETE - Full CLI with --format option supporting csv, json, or both

---

### **US-004** ✅ COMPLETE
**Title:** Validate extracted data

**Description:** As a user, I want to validate extracted data against known golden weeks so that I can trust the accuracy of the extraction process.

**Acceptance Criteria:**
- Validation mode compares extracted data against expected results
- Reports discrepancies
- Provides confidence score

**Status:** COMPLETE - Comprehensive validation with tolerance levels and confidence metrics

---

### **US-005** ✅ COMPLETE
**Title:** Handle data corruption warnings

**Description:** As a user, I want to be warned when PDF data appears corrupted so that I can take appropriate action with problematic files.

**Acceptance Criteria:**
- Script detects anomalous data patterns
- Logs warnings with file names
- Continues processing other files
- Provides summary of issues

**Status:** COMPLETE - Robust error handling with detailed warnings and issue summaries

---

### **US-006** ✅ COMPLETE
**Title:** Consolidate date ranges

**Description:** As a user, I want all extracted data consolidated into a single chronological dataset so that I can analyze patterns across the full time period.

**Acceptance Criteria:**
- Data sorted by date/time
- Duplicate entries handled
- Date ranges clearly identified
- Gaps in data documented

**Status:** COMPLETE - Chronological processing with gap detection and date range handling

---

### **US-007** ✅ COMPLETE
**Title:** Extract additional metadata

**Description:** As a user, I want to extract any available summary statistics from PDFs so that I can have additional context for analysis.

**Acceptance Criteria:**
- Identifies and extracts summary data beyond entry/exit times
- Includes metadata in output
- Documents what additional data is available

**Status:** COMPLETE - Extracts pet info, report dates, daily totals, and session metadata

---

### **US-008** ✅ COMPLETE
**Title:** Handle format variations and multi-page PDFs

**Description:** As a user, I want the tool to handle minor PDF format changes and multi-page table layouts so that it remains functional regardless of PDF structure variations.

**Acceptance Criteria:**
- Flexible parsing handles minor layout changes
- Cross-page table splits handled
- Arbitrary page breaks supported
- Logs format differences
- Maintains backward compatibility
- Fails gracefully on major changes

**Status:** COMPLETE - Handles partial weeks, non-Monday starts, no-activity periods, format variations, and robust multi-page table reconstruction with 100% validation accuracy

---

### **US-009** ✅ COMPLETE
**Title:** Upload PDF via web interface

**Description:** As a user, I want to upload a new weekly PDF file through a web form so that I can add data to the dataset without using my local machine.

**Acceptance Criteria:**
- Simple upload form
- Basic file validation (PDF format, size)
- Clear feedback on upload status
- Accessible from any device

**Status:** COMPLETE - Live at https://cat-flap-stats.herrings.workers.dev with drag-and-drop interface, magic link authentication, and comprehensive file validation

---

### **US-010** ✅ COMPLETE
**Title:** Automated dataset processing

**Description:** As a user, I want uploaded PDFs to be automatically processed and merged with the existing dataset so that the data is immediately available for analysis.

**Acceptance Criteria:**
- GitHub Actions workflow processes PDFs using existing extractor
- Validates extracted data
- Merges with master dataset
- Creates backups before updates

**Status:** COMPLETE - Fully automated GitHub Actions pipeline with intelligent duplicate detection, automatic backups, and version-controlled dataset updates

---

### **US-011** ✅ COMPLETE
**Title:** Processing status notifications

**Description:** As a user, I want to receive email notifications about processing results so that I know if the upload succeeded or failed.

**Acceptance Criteria:**
- Email sent on completion with processing summary
- Error notifications with details
- Success confirmations with data statistics

**Status:** COMPLETE - Email notifications via Resend with detailed processing reports, duplicate detection results, and error handling

---

### **US-012** ✅ COMPLETE
**Title:** Web-based dataset access

**Description:** As a user, I want to access the current dataset through a web interface so that I can download the latest data for analysis tools.

**Acceptance Criteria:**
- Web interface shows dataset status
- Download links for CSV/JSON formats
- Processing history
- Basic statistics

**Status:** COMPLETE - Dashboard interface with dataset statistics, GitHub repository access for CSV/JSON downloads, and processing history via Git commits

---

## Phase 2: Scientific Behavioral Analytics (✅ COMPLETE)

### **US-013** ✅ COMPLETE
**Title:** Basic Activity Rhythm Visualization

**Description:** As Sven's human, I want to see his daily activity rhythms displayed as a scientifically accurate actogram so that I can understand his natural behavioral patterns and identify his "Peak Sven hours".

**Acceptance Criteria:**
- Web dashboard displays chronobiological actogram showing exit/entry events over time
- Activity frequency histogram identifying peak activity periods
- Basic pattern consistency metrics
- Configurable time windows (7-day, monthly views)

**Implementation Notes:** Follow established chronobiology visualization standards with 24-hour X-axis and chronological Y-axis, double-plotting option for overnight patterns

**Status:** COMPLETE - Live at /patterns endpoint with D3.js actogram visualization, activity frequency histogram, and pre-computed analytics from master_dataset.json

**Priority:** Phase 2.1 (Foundation Analytics)

---

### **US-014** ✅ COMPLETE
**Title:** Daily Routine Pattern Analysis

**Description:** As Sven's human, I want to track his daily routine consistency (first exit, last entry times) with scientific tolerance levels so that I can understand his natural schedule and detect meaningful changes.

**Acceptance Criteria:**
- Dashboard shows "Sven's Daily Rhythm" with first exit and last entry time tracking
- Consistency analysis with ±60 minute tolerance for routine detection
- Weekday vs weekend baseline patterns
- Rolling 7-day pattern stability assessment

**Implementation Notes:** Use circular statistics for time-of-day analysis, implement mixed-effects models for weekday/weekend baselines

**Status:** COMPLETE - Implemented in /patterns and /circadian endpoints with comprehensive daily rhythm tracking, weekday/weekend analysis from precomputed.weekdayPatterns, and seasonal baseline comparisons via compute_analytics.py

**Priority:** Phase 2.1 (Foundation Analytics)

---

### **US-015** ✅ COMPLETE
**Title:** Behavioral Annotation System

**Description:** As Sven's human, I want to annotate time periods with contextual information (health events, travel, environmental changes) so that I can correlate behavioral changes with real-world events.

**Acceptance Criteria:**
- Simple interface to add date-range annotations with categories (health, environment, schedule)
- Visual annotation overlays on all behavioral visualizations
- Filter capability to include/exclude annotated periods
- Correlation analysis between annotations and behavior changes

**Implementation Notes:** JSON-based annotation storage, color-coded visualization overlays, integration with all analytics features

**Status:** COMPLETE - Full CRUD annotation system at /annotations endpoint with timeline integration

**Priority:** Phase 2.2 (Contextual Analytics)

---

### **US-016** ✅ COMPLETE
**Title:** Seasonal Pattern Detection

**Description:** As Sven's human, I want to see how his behavioral patterns change across seasons using scientifically robust methods so that I can understand his long-term behavioral rhythms and anticipate seasonal changes.

**Acceptance Criteria:**
- Seasonal baseline comparison (Spring/Summer/Autumn/Winter)
- Statistical significance testing for seasonal differences
- Overlay visualization showing seasonal pattern shifts
- Confidence intervals for pattern reliability

**Implementation Notes:** Use 4+ week periods for seasonal analysis per chronobiology research, spectral analysis for rhythm detection, statistical validation of seasonal differences

**Status:** COMPLETE - UK meteorological season analysis at /seasonal endpoint with statistical validation

**Priority:** Phase 2.2 (Contextual Analytics)

---

### **US-017** ✅ COMPLETE
**Title:** Anomaly Detection and Health Monitoring

**Description:** As Sven's human, I want to be alerted to significant deviations from his established behavioral patterns so that I can identify potential health issues or environmental disruptions early.

**Acceptance Criteria:**
- Statistical anomaly detection using ±2 standard deviation thresholds
- Classification of mild/moderate/significant anomalies
- Sustained pattern disruption alerts (>3 days)
- Integration with annotation system for anomaly correlation

**Implementation Notes:** Implement change point detection algorithms, rolling baseline calculations, configurable alert thresholds

**Status:** COMPLETE - Health monitoring dashboard at /health endpoint with anomaly detection

**Priority:** Phase 2.3 (Advanced Health Monitoring)

---

### **US-018** ✅ COMPLETE
**Title:** Data Quality Dashboard

**Description:** As Sven's human, I want to understand the quality and reliability of the behavioral analysis so that I can interpret results with appropriate confidence.

**Acceptance Criteria:**
- Data completeness visualization by time period
- Sunday truncation impact assessment
- Single timestamp confidence scoring
- Processing report trend analysis
- Validation against known behavioral events

**Implementation Notes:** Quality metrics based on extraction confidence levels, visual indicators for data reliability, systematic missing data handling

**Status:** COMPLETE - Data quality assessment at /quality endpoint with processing metrics

**Priority:** Phase 2.3 (Advanced Health Monitoring)

---

## User Story Summary

### By Status
- **✅ Complete (Phase 1):** 12 user stories
- **✅ Complete (Phase 2):** 6 user stories (US-013, US-014, US-015, US-016, US-017, US-018)
- **Total:** 18 user stories complete

### By Priority
- **Phase 1 - Data Foundation:** US-001 through US-012 (✅ Complete)
- **Phase 2.1 - Foundation Analytics:** US-013, US-014 (✅ Complete)
- **Phase 2.2 - Contextual Analytics:** US-015, US-016 (✅ Complete)
- **Phase 2.3 - Advanced Health Monitoring:** US-017, US-018 (✅ Complete)

### Success Metrics
- **Phase 1 Achievement:** 100% completion (12/12 user stories)
- **Phase 2 Achievement:** 100% completion (6/6 user stories)
- **Overall Completion:** 100% (18/18 user stories complete)
- **Data Quality:** 1,573+ validated sessions, 100% accuracy
- **System Reliability:** Live production system with comprehensive analytics
- **Phase 2 Status:** Complete behavioral analytics platform with 8 specialized dashboards
- **Next Phase:** Platform refinement and polish (Phase 3)
