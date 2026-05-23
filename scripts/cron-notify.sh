#!/bin/bash
# Finarc notification cron script
# Add to crontab with: crontab -e
# 
# Run at 12:00 PM and 9:00 PM daily:
# 0 12 * * * /path/to/Finarc/scripts/cron-notify.sh
# 0 21 * * * /path/to/Finarc/scripts/cron-notify.sh
#
# Or use: crontab -l | { cat; echo "0 12,21 * * * $(pwd)/scripts/cron-notify.sh"; } | crontab -

APP_URL="${FINARC_URL:-http://localhost:3000}"

curl -s "${APP_URL}/api/cron/notify" > /dev/null 2>&1

echo "[$(date)] Finarc notifications checked" >> /tmp/finarc-cron.log
