#!/bin/bash
# ABOUT: Prune old dataset backups, keeping only the 3 most recent
# ABOUT: Safely removes timestamped backup directories while preserving other files

set -e  # Exit on any error

echo "=== Dataset Backup Pruning ==="
echo "Keeping only the 3 most recent timestamped backup directories"

# Check if dataset_backups directory exists
if [ ! -d "dataset_backups" ]; then
    echo "No dataset_backups directory found - nothing to prune"
    exit 0
fi

cd dataset_backups

# List all timestamped directories (format: YYYYMMDD_HHMMSS) and sort by name (chronological)
# Only match directories that exactly match the timestamp pattern for safety
BACKUP_DIRS=$(find . -maxdepth 1 -type d -name "[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]" | sort)

if [ -z "$BACKUP_DIRS" ]; then
    echo "No timestamped backup directories found"
    exit 0
fi

BACKUP_COUNT=$(echo "$BACKUP_DIRS" | wc -l)
echo "Found $BACKUP_COUNT timestamped backup directories:"
echo "$BACKUP_DIRS" | sed 's/^./  /'

if [ $BACKUP_COUNT -le 3 ]; then
    echo "Only $BACKUP_COUNT backup directories found - no pruning needed (keeping ≤3)"
    exit 0
fi

# Calculate how many to remove (keep the last 3)
REMOVE_COUNT=$((BACKUP_COUNT - 3))
echo ""
echo "Removing oldest $REMOVE_COUNT backup directories (keeping 3 most recent)..."

# Get directories to remove (first N in sorted list)
DIRS_TO_REMOVE=$(echo "$BACKUP_DIRS" | head -n $REMOVE_COUNT)

echo "Directories to be removed:"
echo "$DIRS_TO_REMOVE" | sed 's/^./  /'

# Confirm before deletion
echo ""
read -p "Proceed with deletion? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted - no changes made"
    exit 0
fi

# Remove the oldest directories
echo "$DIRS_TO_REMOVE" | while read dir; do
    if [ -d "$dir" ] && [ "$dir" != "." ]; then
        echo "Removing: $dir"
        rm -rf "$dir"
    fi
done

echo ""
echo "✅ Backup pruning completed!"
echo "Remaining backup directories:"
find . -maxdepth 1 -type d -name "[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]" | sort | sed 's/^./  /'