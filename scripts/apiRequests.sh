#!/usr/bin/env bash
set -ex

# 航路API リクエスト
curl -X GET "https://con-drone-drone-corridor.dts-digiline.com/airwayReservations?airwayReservationId=123e4567-e89b-12d3-a456-426614174000" \
     -H "Authorization: Bearer <ACCESS-TOKEN>" \
     -H "X-API-KEY: <API-KEY>"

# ヒヤリハットAPI リクエスト
curl -X POST "https://con-drone-drone-corridor.dts-digiline.com/nearMissInformation" \
     -H "Authorization: Bearer <ACCESS-TOKEN>" \
     -H "X-API-KEY: <API-KEY>" \
     -H "Content-Type: application/json" \
     -d '{
       "dataModelType": "test1",
       "attributes": {
         "areaInfo": {
           "type": "Polygon",
           "coordinates": [
             [137.7, 37.8],
             [140.7, 37.8],
             [140.7, 34.8],
             [137.7, 34.8],
             [137.7, 37.8]
           ]
         },
         "startAt": "2025-03-01T00:00:00Z",
         "endAt": "2025-03-20T23:59:59Z"
       }
     }'
