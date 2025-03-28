import { SimpleHandler } from "../libs/api-gateway";
import * as Accept from "@hapi/accept";
import { Headers } from "node-fetch";
import { encodeBuffer } from "http-encoding";
import { isEqual } from "lodash";
import { vector_tile } from "../libs/protobuf";
import tilebelt from '@mapbox/tilebelt';
import { calculateGeoidHeight, getGeoidModel } from "../libs/geoid";
import { version, cacheControlHeader } from "../libs/version";

// SCALE_FACTOR determines the count of geoid tiles in a single tile.
// That means that the tiles in a single tile at zoom level `z` are at zoom level `z + SCALE_FACTOR`.
// For example, if SCALE_FACTOR is 6, the tiles in a single tile at zoom level 19 are at zoom level 25.
// This also determines how many geoid tiles are in a single vector tile.
// There will be 2^(SCALE_FACTOR + 1) geoid tiles in a single vector tile.
// (Because the tile extent will be 2^SCALE_FACTOR, the tile dimensions will be 2^SCALE_FACTOR x 2^SCALE_FACTOR)
const SCALE_FACTOR = 4;

export const metaHandler: SimpleHandler = async (event) => {
  let hostname = `https://${event.requestContext.domainName}`;
  if (process.env.IS_OFFLINE) {
    hostname = 'http://localhost:3000';
  }

  const body = JSON.stringify({
    "tilejson": "3.0.0",
    "tiles": [
      `${hostname}/geoid/tiles/{z}/{x}/{y}.pbf?v=${version}`,
    ],
    "vector_layers": [
      {
        "id": "geoid",
        "fields": {
          "geoid_height": "Number, height of geoid from reference ellipsoid in millimeters.",
          "x": "Number, the X value of the tile.",
          "y": "Number, the Y value of the tile.",
          "z": "Number, the Z value of the tile.",
        }
      }
    ],
    "minzoom": 0,
    "maxzoom": 25 - SCALE_FACTOR,
    "name": "geoid",
    "attribution": "<a href=\"https://www.gsi.go.jp/\" target=\"_blank\">&copy; GSI Japan</a>",
    "version": version,
  });

  return {
    statusCode: 200,
    body,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=30',
    },
  };
};

type Tile = [number, number, number];
type LngLat = [number, number];
function childrenTilesForTile(tile: Tile, targetZoom: number): Tile[] {
  const [x, y, z] = tile;
  if (z === targetZoom) {
    return [tile];
  }

  const children: Tile[] = [];
  for (const child of tilebelt.getChildren([x, y, z])) {
    children.push(...childrenTilesForTile(child as Tile, targetZoom));
  }
  return children;
}

function getCenterOfTile(tile: Tile): LngLat {
  const [w, s, e, n] = tilebelt.tileToBBOX(tile);
  return [(w + e) / 2, (s + n) / 2];
}

const zz = (value: number) => (value << 1) ^ (value >> 31);

export const tileHandler: SimpleHandler = async (event) => {
  const model = await getGeoidModel('gsigeo2011_ver2_1.json.br');
  const headers = new Headers(event.headers);

  const { x, y: origY, z } = event.pathParameters;
  const [ y, ] = origY.split(".");
  const xInt = parseInt(x, 10);
  const yInt = parseInt(y, 10);
  const zInt = parseInt(z, 10);

  const thisTile: Tile = [xInt, yInt, zInt];
  const tileExtent = 2**SCALE_FACTOR;

  const features: vector_tile.Tile.IFeature[] = [];
  const keys: string[] = [
    "geoid_height",
    "x",
    "y",
    "z",
  ];
  const values: vector_tile.Tile.IValue[] = [];
  const addValue = (value: vector_tile.Tile.IValue) => {
    let valIdx = values.findIndex((x) => isEqual(x, value));
    if (valIdx === -1) {
      valIdx = values.push(value) - 1;
    }
    return valIdx;
  }

  for (const childTile of childrenTilesForTile(thisTile, zInt + SCALE_FACTOR)) {
    const [x, y, z] = childTile;
    const centerCoords = getCenterOfTile(childTile);
    const geoidHeight = calculateGeoidHeight(model, centerCoords[0], centerCoords[1]);
    if (geoidHeight === 999) {
      // error value
      continue;
    }
    const relX = x - xInt * tileExtent;
    const relY = y - yInt * tileExtent;
    const feature = {
      type: vector_tile.Tile.GeomType.POLYGON,
      geometry: [
        ((1 & 0x7) | (1 << 3)), // MoveTo for 1
          zz(relX), // x
          zz(relY), // y
        ((2 & 0x7) | (3 << 3)), // LineTo for 3
          zz(1),  zz(0),
          zz(0),  zz(1),
          zz(-1), zz(0),
        15, // close path
      ],
      tags: [
        0, // geoid_height
        addValue({ intValue: Math.round(geoidHeight * 1000) }),
        1, // x
        addValue({ intValue: x }),
        2, // y
        addValue({ intValue: y }),
        3, // z
        addValue({ intValue: z }),
      ],
    };
    features.push(feature);
  }

  const tile = vector_tile.Tile.create({
    layers: [
      {
        version: 2,
        name: "geoid",
        extent: tileExtent,
        features: features,
        keys,
        values,
      }
    ]
  });

  const resolvedEncoding = Accept.encoding(headers.get('accept-encoding'), ['zstd', 'br', 'deflate', 'gzip']) as "zstd" | "br" | "deflate" | "gzip" | "";

  const respHeaders: { [key: string]: string } = {
    'content-type': 'application/vnd.mapbox-vector-tile',
    'cache-control': cacheControlHeader,
  };

  const buffer = vector_tile.Tile.encode(tile).finish() as Buffer;

  let encodedBuffer = buffer;
  if (resolvedEncoding !== "") {
    encodedBuffer = await encodeBuffer(buffer, resolvedEncoding);
    respHeaders['vary'] = 'accept-encoding';
    respHeaders['content-encoding'] = resolvedEncoding;
  }

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: respHeaders,
    body: encodedBuffer.toString('base64'),
  };
};

