#!/bin/bash
clients=("android" "web" "tv" "android_vr" "android_embedded" "web_creator" "ios" "web_embedded")
for client in "${clients[@]}"; do
  echo "Testing $client..."
  yt-dlp --extractor-args "youtube:player_client=$client" --simulate https://www.youtube.com/watch?v=BaW_jenozKc
  if [ $? -eq 0 ]; then
    echo "SUCCESS: $client"
    exit 0
  fi
done
echo "ALL FAILED"
