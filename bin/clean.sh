#!/usr/bin/env

if type gsed &>/dev/null; then
  for filename in "$(pwd)/docs/*.md"; do
    gsed -i 's/v0.0.0/master/g' $filename
  done
else
  for filename in "$(pwd)/docs/*.md"; do
    sed -i 's/v0.0.0/master/g' $filename
  done
fi