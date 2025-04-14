#!/bin/bash

# -------- CONFIG --------
MIRROR_BASE="/var/spool/apt-mirror/mirror/archive.ubuntu.com/ubuntu"
DIST="noble"
ARCHS=("amd64" "all")  # You can add more like i386 if needed
COMPONENTS=("main" "universe" "multiverse" "restricted")
POOL_DIR="$MIRROR_BASE/pool"
TEMP_DIR="/tmp/noble_debs_to_delete"

# -------- START --------
echo "[INFO] Starting cleanup for Ubuntu 24.04 (noble)"
mkdir -p "$TEMP_DIR"
DEB_LIST="$TEMP_DIR/debs.txt"

> "$DEB_LIST"

# Extract all .deb paths from noble's Package.gz files
for COMP in "${COMPONENTS[@]}"; do
    for ARCH in "${ARCHS[@]}"; do
        PKG_FILE="$MIRROR_BASE/dists/$DIST/$COMP/binary-$ARCH/Packages.gz"
        if [[ -f "$PKG_FILE" ]]; then
            echo "[INFO] Processing $PKG_FILE"
            zcat "$PKG_FILE" | grep "^Filename: " | awk '{print $2}' >> "$DEB_LIST"
        fi
    done
done

echo "[INFO] Total noble packages found: $(wc -l < "$DEB_LIST")"

# Remove each .deb file if it exists in the mirror pool
DELETED_COUNT=0
while IFS= read -r REL_PATH; do
    FULL_PATH="$MIRROR_BASE/$REL_PATH"
    if [[ -f "$FULL_PATH" ]]; then
        rm -f "$FULL_PATH"
        ((DELETED_COUNT++))
        echo "[DELETED] $FULL_PATH"
    fi
done < "$DEB_LIST"

echo "[DONE] Deleted $DELETED_COUNT .deb files related to Ubuntu 24.04 (noble)."

# Optional: remove the empty directories
find "$POOL_DIR" -type d -empty -delete
