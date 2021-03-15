#!/usr/bin/env bash

set -e

for row in $(echo "${sample}" | ./bin/run spreadsheet:get -s "${TEST_SPREADSHEET_ID}" -r | jq -r '.sheets[] | select( .properties.title != "[automated_testing]") | @base64'); do
  _jq() {
    echo ${row} | base64 --decode | jq -r ${1}
  }
  ./bin/run worksheet:remove -t "$(_jq '.properties.title')" -s "${TEST_SPREADSHEET_ID}"
done
