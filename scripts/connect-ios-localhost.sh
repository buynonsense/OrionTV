#!/bin/sh

set -eu

DEVICE_ID="${1:-booted}"
PORT="${2:-8081}"
ENCODED_URL="http%3A%2F%2F127.0.0.1%3A${PORT}"
DEV_CLIENT_URL="com.oriontv://expo-development-client/?url=${ENCODED_URL}"

xcrun simctl terminate "$DEVICE_ID" com.oriontv >/dev/null 2>&1 || true
xcrun simctl openurl "$DEVICE_ID" "$DEV_CLIENT_URL"
