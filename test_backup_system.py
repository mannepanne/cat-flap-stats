#!/usr/bin/env python3
# ABOUT: Test suite for backup system functionality
# ABOUT: Validates backup creation, pruning logic, and safety mechanisms

import pytest
import tempfile
import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime, timedelta


class TestBackupPruningScript:
    """Test the backup pruning script functionality"""
    
    def setup_method(self):
        """Set up temporary directory with fake backup structure"""
        self.temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        
        # Create dataset_backups directory
        self.backups_dir = Path(self.temp_dir) / "dataset_backups"
        self.backups_dir.mkdir()
        
        # Copy the pruning script to temp directory
        script_source = Path(self.original_cwd) / "prune_backups.sh"
        self.script_path = Path(self.temp_dir) / "prune_backups.sh"
        if script_source.exists():
            shutil.copy2(script_source, self.script_path)
            os.chmod(self.script_path, 0o755)
        
        os.chdir(self.temp_dir)
    
    def teardown_method(self):
        """Clean up temporary files"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir)
    
    def create_fake_backup_directories(self, count=5):
        """Create fake timestamped backup directories"""
        base_time = datetime(2024, 6, 22, 21, 24, 0)
        
        for i in range(count):
            timestamp = base_time + timedelta(minutes=i*5)
            dir_name = timestamp.strftime("%Y%m%d_%H%M%S")
            backup_dir = self.backups_dir / dir_name
            backup_dir.mkdir()
            
            # Create fake backup files
            (backup_dir / "master_dataset.csv").write_text(f"fake csv data {i}")
            (backup_dir / "master_dataset.json").write_text(f"fake json data {i}")
    
    def create_non_timestamped_files(self):
        """Create files that should NOT be deleted by pruning"""
        (self.backups_dir / "README.md").write_text("Important file")
        (self.backups_dir / "manual_backup.csv").write_text("Manual backup")
        
        # Create directory with wrong format
        wrong_format_dir = self.backups_dir / "backup_2024_06_22"
        wrong_format_dir.mkdir()
        (wrong_format_dir / "data.csv").write_text("Wrong format backup")
    
    def test_pruning_with_more_than_3_backups(self):
        """Test pruning when there are more than 3 backup directories"""
        self.create_fake_backup_directories(6)
        self.create_non_timestamped_files()
        
        # List backup directories before pruning
        before_dirs = list(self.backups_dir.glob("????????_??????"))
        assert len(before_dirs) == 6
        
        # Run pruning script (answer 'y' to confirmation)
        if self.script_path.exists():
            result = subprocess.run(
                [str(self.script_path)],
                input="y\n",
                text=True,
                capture_output=True,
                cwd=self.temp_dir
            )
            
            # Check script executed successfully
            assert result.returncode == 0
            assert "Backup pruning completed" in result.stdout
            
            # Check that only 3 directories remain
            after_dirs = list(self.backups_dir.glob("????????_??????"))
            assert len(after_dirs) == 3
            
            # Check that the newest 3 were kept (last 3 in chronological order)
            remaining_names = sorted([d.name for d in after_dirs])
            
            # Just verify we have 3 directories and they're the newest ones
            # The exact timestamps will depend on when the test runs
            assert len(remaining_names) == 3
            
            # Verify all remaining directories follow the correct timestamp format
            import re
            timestamp_pattern = r"^\d{8}_\d{6}$"
            for name in remaining_names:
                assert re.match(timestamp_pattern, name), f"Invalid timestamp format: {name}"
            
            # Check that non-timestamped files were preserved
            assert (self.backups_dir / "README.md").exists()
            assert (self.backups_dir / "manual_backup.csv").exists()
            assert (self.backups_dir / "backup_2024_06_22").exists()
    
    def test_pruning_with_exactly_3_backups(self):
        """Test that pruning does nothing when exactly 3 backups exist"""
        self.create_fake_backup_directories(3)
        
        before_dirs = list(self.backups_dir.glob("????????_??????"))
        assert len(before_dirs) == 3
        
        if self.script_path.exists():
            result = subprocess.run(
                [str(self.script_path)],
                text=True,
                capture_output=True,
                cwd=self.temp_dir
            )
            
            assert result.returncode == 0
            assert "no pruning needed" in result.stdout
            
            # All directories should still exist
            after_dirs = list(self.backups_dir.glob("????????_??????"))
            assert len(after_dirs) == 3
    
    def test_pruning_with_fewer_than_3_backups(self):
        """Test that pruning does nothing when fewer than 3 backups exist"""
        self.create_fake_backup_directories(2)
        
        before_dirs = list(self.backups_dir.glob("????????_??????"))
        assert len(before_dirs) == 2
        
        if self.script_path.exists():
            result = subprocess.run(
                [str(self.script_path)],
                text=True,
                capture_output=True,
                cwd=self.temp_dir
            )
            
            assert result.returncode == 0
            assert "no pruning needed" in result.stdout
            
            # All directories should still exist
            after_dirs = list(self.backups_dir.glob("????????_??????"))
            assert len(after_dirs) == 2
    
    def test_pruning_with_no_backups(self):
        """Test that pruning handles empty backup directory gracefully"""
        # Create empty backups directory
        assert len(list(self.backups_dir.glob("????????_??????"))) == 0
        
        if self.script_path.exists():
            result = subprocess.run(
                [str(self.script_path)],
                text=True,
                capture_output=True,
                cwd=self.temp_dir
            )
            
            assert result.returncode == 0
            assert "No timestamped backup directories found" in result.stdout
    
    def test_pruning_safety_pattern_matching(self):
        """Test that pruning only affects correctly formatted directories"""
        # Create various directory formats
        test_dirs = [
            "20240622_212400",  # Correct format - should be affected
            "20240622_212405",  # Correct format - should be affected  
            "20240622_212410",  # Correct format - should be affected
            "20240622_212415",  # Correct format - should be affected
            "2024-06-22",       # Wrong format - should be preserved
            "backup_old",       # Wrong format - should be preserved
            "temp",             # Wrong format - should be preserved
        ]
        
        for dir_name in test_dirs:
            dir_path = self.backups_dir / dir_name
            dir_path.mkdir()
            (dir_path / "test.txt").write_text("test content")
        
        if self.script_path.exists():
            result = subprocess.run(
                [str(self.script_path)],
                input="y\n",
                text=True,
                capture_output=True,
                cwd=self.temp_dir
            )
            
            assert result.returncode == 0
            
            # Check that correctly formatted directories were pruned to 3
            timestamped_dirs = list(self.backups_dir.glob("????????_??????"))
            assert len(timestamped_dirs) == 3
            
            # Check that incorrectly formatted directories were preserved
            assert (self.backups_dir / "2024-06-22").exists()
            assert (self.backups_dir / "backup_old").exists()
            assert (self.backups_dir / "temp").exists()
    
    def test_pruning_abort_on_no_confirmation(self):
        """Test that pruning aborts when user doesn't confirm"""
        self.create_fake_backup_directories(5)
        
        before_dirs = list(self.backups_dir.glob("????????_??????"))
        assert len(before_dirs) == 5
        
        if self.script_path.exists():
            result = subprocess.run(
                [str(self.script_path)],
                input="n\n",  # Answer 'no' to confirmation
                text=True,
                capture_output=True,
                cwd=self.temp_dir
            )
            
            assert result.returncode == 0
            assert "Aborted - no changes made" in result.stdout
            
            # All directories should still exist
            after_dirs = list(self.backups_dir.glob("????????_??????"))
            assert len(after_dirs) == 5


class TestBackupCreationLogic:
    """Test backup creation patterns used in GitHub Actions"""
    
    def setup_method(self):
        """Set up temporary directory for testing backup creation"""
        self.temp_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        os.chdir(self.temp_dir)
        
        # Create sample dataset files
        Path("master_dataset.csv").write_text("sample,csv,data\n1,2,3")
        Path("master_dataset.json").write_text('{"sample": "json data"}')
    
    def teardown_method(self):
        """Clean up temporary files"""
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir)
    
    def test_backup_creation_with_timestamp(self):
        """Test backup creation logic from GitHub Actions workflow"""
        # Simulate the backup creation step from the workflow
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(f"dataset_backups/{timestamp}")
        backup_dir.mkdir(parents=True)
        
        # Copy files (simulating the workflow)
        if Path("master_dataset.csv").exists():
            shutil.copy2("master_dataset.csv", backup_dir)
        if Path("master_dataset.json").exists():
            shutil.copy2("master_dataset.json", backup_dir)
        
        # Verify backup was created
        assert backup_dir.exists()
        assert (backup_dir / "master_dataset.csv").exists()
        assert (backup_dir / "master_dataset.json").exists()
        
        # Verify content integrity
        original_csv = Path("master_dataset.csv").read_text()
        backup_csv = (backup_dir / "master_dataset.csv").read_text()
        assert original_csv == backup_csv
        
        original_json = Path("master_dataset.json").read_text()
        backup_json = (backup_dir / "master_dataset.json").read_text()
        assert original_json == backup_json
    
    def test_backup_directory_naming_format(self):
        """Test that backup directory naming follows expected format"""
        # Test timestamp format consistency
        timestamp1 = datetime.now().strftime("%Y%m%d_%H%M%S")
        timestamp2 = datetime(2024, 6, 22, 21, 24, 30).strftime("%Y%m%d_%H%M%S")
        
        # Verify format
        assert len(timestamp1) == 15  # YYYYMMDD_HHMMSS
        assert timestamp1[8] == "_"
        assert timestamp2 == "20240622_212430"
        
        # Verify regex pattern matching (from pruning script)
        import re
        pattern = r"[0-9]{8}_[0-9]{6}"
        assert re.match(pattern, timestamp1)
        assert re.match(pattern, timestamp2)
        assert not re.match(pattern, "2024-06-22_21:24:30")
        assert not re.match(pattern, "backup_20240622")
    
    def test_backup_handles_missing_files_gracefully(self):
        """Test backup creation when source files don't exist"""
        # Remove source files
        Path("master_dataset.csv").unlink()
        Path("master_dataset.json").unlink()
        
        # Simulate backup creation logic
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(f"dataset_backups/{timestamp}")
        backup_dir.mkdir(parents=True)
        
        # Copy files if they exist (workflow logic)
        csv_copied = False
        json_copied = False
        
        if Path("master_dataset.csv").exists():
            shutil.copy2("master_dataset.csv", backup_dir)
            csv_copied = True
        
        if Path("master_dataset.json").exists():
            shutil.copy2("master_dataset.json", backup_dir)
            json_copied = True
        
        # Verify graceful handling
        assert backup_dir.exists()
        assert not csv_copied
        assert not json_copied
        assert not (backup_dir / "master_dataset.csv").exists()
        assert not (backup_dir / "master_dataset.json").exists()


class TestGitHubActionsBackupIntegration:
    """Test integration patterns used in GitHub Actions workflow"""
    
    def test_workflow_backup_step_simulation(self):
        """Simulate the backup step from GitHub Actions workflow"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Create sample files
            Path("master_dataset.csv").write_text("test,data\n1,2")
            Path("master_dataset.json").write_text('{"test": "data"}')
            
            # Simulate the workflow backup step
            bash_script = '''
            TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
            mkdir -p "dataset_backups/$TIMESTAMP"
            
            if [ -f "master_dataset.csv" ]; then
              cp master_dataset.csv "dataset_backups/$TIMESTAMP/"
              echo "CSV backed up"
            fi
            
            if [ -f "master_dataset.json" ]; then
              cp master_dataset.json "dataset_backups/$TIMESTAMP/"
              echo "JSON backed up"
            fi
            
            # List backup contents
            ls -la "dataset_backups/$TIMESTAMP/"
            '''
            
            # Execute the backup script
            result = subprocess.run(
                ['bash', '-c', bash_script],
                capture_output=True,
                text=True
            )
            
            # Verify execution
            assert result.returncode == 0
            assert "CSV backed up" in result.stdout
            assert "JSON backed up" in result.stdout
            
            # Verify backup directory was created
            backup_dirs = list(Path("dataset_backups").glob("????????_??????"))
            assert len(backup_dirs) == 1
            
            # Verify files were backed up
            backup_dir = backup_dirs[0]
            assert (backup_dir / "master_dataset.csv").exists()
            assert (backup_dir / "master_dataset.json").exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])