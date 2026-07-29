#!/usr/bin/env bash
#
# Reads the Android system log so a native crash says something.
#
# When the app dies before React mounts, Metro shows nothing and the JS error
# handler never runs, because the process is gone. The reason is in Android's
# own log and nowhere else. This waits for a device, clears the log, and then
# prints only the lines that matter while you open the app.
#
#   npm run android:log
#
# The phone needs developer options on. Either plug in a USB cable with "USB
# debugging" enabled, or use "Wireless debugging" over the wifi you are already
# on, which needs a one-time pairing:
#
#   adb pair <ip>:<pairing-port>     # the code is on the phone's screen
#   adb connect <ip>:<port>          # a different port, also on that screen
#
set -u

find_adb() {
  if command -v adb >/dev/null 2>&1; then command -v adb; return; fi
  for c in "$HOME/.local/share/android-platform-tools/adb" \
           "$HOME/Android/Sdk/platform-tools/adb" \
           "$HOME/Library/Android/sdk/platform-tools/adb"; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
}

ADB="$(find_adb)"
if [ -z "${ADB:-}" ]; then
  cat <<'MSG'
adb is not on this machine.

It ships as a plain zip, no install and no sudo:

  curl -sLO https://dl.google.com/android/repository/platform-tools-latest-linux.zip
  unzip -q platform-tools-latest-linux.zip
  export PATH="$PWD/platform-tools:$PATH"

Then run this again.
MSG
  exit 1
fi
echo "adb: $ADB"

if [ -z "$("$ADB" devices | sed '1d' | grep -w device)" ]; then
  echo
  echo "No device connected. On the phone:"
  echo "  Settings > About phone > tap Build number seven times"
  echo "  Settings > Developer options > enable USB debugging, then plug in the cable"
  echo "  or enable Wireless debugging and pair, see the header of this script"
  echo
  echo "Waiting for a device, Ctrl+C to give up..."
  "$ADB" wait-for-device
fi

echo "Device: $("$ADB" devices | sed '1d' | head -1)"
"$ADB" logcat -c 2>/dev/null || true

cat <<'MSG'

Log cleared. Open the app in Expo Go now.
Anything fatal appears below. Ctrl+C when it has crashed.

MSG

# Fatal signals, the Java stack, the ART runtime, and Expo Go's own tag. Errors
# and above only, or the phone's ordinary chatter buries the crash.
"$ADB" logcat "*:E" AndroidRuntime:E ExpoGo:V ReactNative:V ReactNativeJS:V DEBUG:V libc:F
