#!/bin/bash

# -------- CONFIG --------
REPO_BASE="/ubuntu_packages/ubuntu/mirror/archive.ubuntu.com/ubuntu"  # Base path
TARGET_DIST="noble"                  # Ubuntu 24 to remove
OTHER_DISTS=("bionic" "focal" "jammy")  # Keep 18.04, 20.04, 22.04
ARCHS=("amd64" "all")                # Architectures to check
COMPONENTS=("main" "universe" "multiverse" "restricted")  # Repository components
TEMP_DIR="/tmp/ubuntu_cleanup"       # Temporary working directory

# -------- SAFETY CHECKS --------
if [[ ! -d "$REPO_BASE/dists" ]] || [[ ! -d "$REPO_BASE/pool" ]]; then
  echo "[ERROR] Invalid repository base path: $REPO_BASE"
  exit 1
fi

# -------- INITIALIZATION --------
mkdir -p "$TEMP_DIR"
TARGET_DEBS="$TEMP_DIR/target_debs.txt"    # Packages used by noble
OTHER_DEBS="$TEMP_DIR/other_debs.txt"      # Packages used by other releases
SAFE_TO_DELETE="$TEMP_DIR/safe_to_delete.txt"  # Final list for deletion

> "$TARGET_DEBS"
> "$OTHER_DEBS"

# -------- STEP 1: Identify ALL packages used by noble (target) --------
echo "[INFO] Identifying packages for $TARGET_DIST..."
for COMP in "${COMPONENTS[@]}"; do
  for ARCH in "${ARCHS[@]}"; do
    PKG_FILE="$REPO_BASE/dists/$TARGET_DIST/$COMP/binary-$ARCH/Packages.gz"
    if [[ -f "$PKG_FILE" ]]; then
      zcat "$PKG_FILE" | awk '/^Filename: /{print $2}' >> "$TARGET_DEBS"
    fi
  done
done

# -------- STEP 2: Identify packages used by OTHER releases --------
echo "[INFO] Identifying packages for other releases..."
for DIST in "${OTHER_DISTS[@]}"; do
  for COMP in "${COMPONENTS[@]}"; do
    for ARCH in "${ARCHS[@]}"; do
      PKG_FILE="$REPO_BASE/dists/$DIST/$COMP/binary-$ARCH/Packages.gz"
      if [[ -f "$PKG_FILE" ]]; then
        zcat "$PKG_FILE" | awk '/^Filename: /{print $2}' >> "$OTHER_DEBS"
      fi
    done
  done
done

# -------- STEP 3: Find SAFE-TO-DELETE packages (exist ONLY in noble) --------
echo "[INFO] Calculating safe-to-delete packages..."
sort -u "$TARGET_DEBS" > "$TARGET_DEBS.sorted"
sort -u "$OTHER_DEBS" > "$OTHER_DEBS.sorted"
comm -23 "$TARGET_DEBS.sorted" "$OTHER_DEBS.sorted" > "$SAFE_TO_DELETE"

# -------- STEP 4: Delete SAFELY --------
DELETED_COUNT=0
echo "[INFO] Starting safe deletions..."
while IFS= read -r REL_PATH; do
  FULL_PATH="$REPO_BASE/$REL_PATH"
  if [[ -f "$FULL_PATH" ]]; then
    rm -f "$FULL_PATH"
    ((DELETED_COUNT++))
    echo "[DELETED] $FULL_PATH"
  fi
done < "$SAFE_TO_DELETE"

# -------- STEP 5: Remove noble metadata and cleanup --------
echo "[INFO] Removing $TARGET_DIST metadata..."
rm -rf "$REPO_BASE/dists/$TARGET_DIST"

echo "[INFO] Cleaning empty directories..."
find "$REPO_BASE/pool" -type d -empty -delete

# -------- FINAL REPORT --------
TOTAL_PACKAGES=$(wc -l < "$TARGET_DEBS.sorted")
echo "[DONE] Deleted $DELETED_COUNT/$TOTAL_PACKAGES packages exclusive to Ubuntu 24.04 (noble)."
