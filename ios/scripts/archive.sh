#!/bin/zsh

set -euo pipefail

script_dir="${0:A:h}"
project_root="${script_dir:h}"
personal_team="8F7LXHTJZR"
development_team="${CALORIE_DEVELOPMENT_TEAM:-$personal_team}"
archive_path="${CALORIE_ARCHIVE_PATH:-$project_root/build/Calorie.xcarchive}"
allow_updates="${CALORIE_ALLOW_PROVISIONING_UPDATES:-NO}"

if [[ "$development_team" != "$personal_team" ]]; then
  print -u2 "Refusing to archive: Calorie is locked to personal team $personal_team."
  exit 3
fi

cd "$project_root"
xcodegen generate
arguments=()
if [[ "$allow_updates" == "YES" ]]; then arguments=(-allowProvisioningUpdates); fi
xcodebuild archive -project Calorie.xcodeproj -scheme Calorie -configuration Release -destination 'generic/platform=iOS' -archivePath "$archive_path" "${arguments[@]}" DEVELOPMENT_TEAM="$development_team"
codesign --verify --deep --strict "$archive_path/Products/Applications/Calorie.app"
print "Created and verified local archive at $archive_path"
print "No upload or App Store Connect operation was performed."
