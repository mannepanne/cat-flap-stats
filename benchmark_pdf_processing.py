#!/usr/bin/env python3
"""
Performance benchmark script for PDF processing optimization
"""
import time
import os
from pathlib import Path
from cat_flap_extractor_v5 import ProductionCatFlapExtractor

def benchmark_pdf_processing():
    """Benchmark PDF processing performance"""
    sample_pdfs = []
    for pattern in ["*.pdf", "SAMPLEDATA/*.pdf", "test_data/*.pdf"]:
        sample_pdfs.extend(Path(".").glob(pattern))
    
    if not sample_pdfs:
        print("No sample PDF files found for benchmarking")
        return
    
    extractor = ProductionCatFlapExtractor()
    
    for pdf_path in sample_pdfs[:3]:
        print(f"\nBenchmarking: {pdf_path}")
        
        start_time = time.time()
        result = extractor.process_pdf(pdf_path)
        processing_time = time.time() - start_time
        
        if result:
            session_count = len(result['session_data'])
            print(f"  ✅ Processed {session_count} sessions in {processing_time:.2f}s")
        else:
            print(f"  ❌ Processing failed in {processing_time:.2f}s")

if __name__ == "__main__":
    benchmark_pdf_processing()
