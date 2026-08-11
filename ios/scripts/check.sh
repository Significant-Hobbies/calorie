#!/bin/zsh

set -euo pipefail

script_dir="${0:A:h}"
project_root="${script_dir:h}"
destination="${CALORIE_SIMULATOR_DESTINATION:-platform=iOS Simulator,id=38FDB30B-69F2-406E-A253-17183F2348BE}"
derived_data="${CALORIE_DERIVED_DATA:-/private/tmp/calorie-ios-derived}"

cd "$project_root"
xcodegen generate
xcodebuild -project Calorie.xcodeproj -scheme Calorie -destination "$destination" -derivedDataPath "$derived_data" test
xcodebuild -project Calorie.xcodeproj -scheme Calorie -configuration Release -destination "$destination" -derivedDataPath "$derived_data" CODE_SIGNING_ALLOWED=NO build
