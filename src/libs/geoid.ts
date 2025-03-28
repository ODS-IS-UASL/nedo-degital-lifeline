import fs from 'node:fs';
import path from 'node:path';

import sax from 'sax';
import { brotliDecompressToString } from './compression';

type GeoidModel = {
  dat: number[][]
  glamn: number
  glomn: number
  dgla: number
  dglo: number
  nla: number
  nlo: number
  ikind: number
  vern: string
}

const ELEMENT_TAG_NAMES = [
  "Z",
  "glamn",
  "glomn",
  "dgla",
  "dglo",
  "nla",
  "nlo",
  "ikind",
  "vern",
];

export function loadXMLGeoidModel(path: string): Promise<GeoidModel> {
  return new Promise((resolve, reject) => {
    const model: GeoidModel = {
      dat: new Array(1802).fill(0).map(() => new Array(1202).fill(999)),
      glamn: 0,
      glomn: 0,
      dgla: 0,
      dglo: 0,
      nla: 0,
      nlo: 0,
      ikind: 0,
      vern: "",
    };

    let idxB: number, idxL: number;

    const parser = sax.createStream(true, { trim: true });
    parser.on('error', function (e) {
      reject(e);
    });

    let elementId = -1;
    parser.on('opentag', function (node) {
      if (node.name === 'geoid_height') {
        const id = node.attributes.id.toString();
        const idMatches = id.match(/^geoid(\d{4})(\d{4})$/);
        if (!idMatches) {
          throw new Error(`Invalid geoid_height id: ${id}`);
        }
        idxB = parseInt(idMatches[1], 10);
        idxL = parseInt(idMatches[2], 10);
      } else {
        elementId = ELEMENT_TAG_NAMES.indexOf(node.name);
      }
    });

    parser.on('closetag', function () {
      elementId = -1;
    });

    parser.on('text', function (text) {
      switch (elementId) {
        case 0:
          // console.log(`setting ${idxB+1}, ${idxL+1} to ${text}`);
          model.dat[idxB+1][idxL+1] = parseFloat(text);
          break;
        case 1:
          model.glamn = parseFloat(text);
          break;
        case 2:
          model.glomn = parseFloat(text);
          break;
        case 3:
          model.dgla = parseFloat(text);
          break;
        case 4:
          model.dglo = parseFloat(text);
          break;
        case 5:
          model.nla = parseInt(text, 10);
          break;
        case 6:
          model.nlo = parseInt(text, 10);
          break;
        case 7:
          model.ikind = parseInt(text, 10);
          break;
        case 8:
          model.vern = text;
          break;
        default:
          break;
      }
    });

    parser.on('end', function () {
      resolve(model);
    });

    fs.createReadStream(path).pipe(parser);
  });
}

export async function loadJSONGeoidModel(inputPath: string): Promise<GeoidModel> {
  let contents: string;
  if (path.extname(inputPath) === '.br') {
    contents = await brotliDecompressToString(inputPath);
  } else {
    contents = await fs.promises.readFile(inputPath, 'utf-8');
  }
  return JSON.parse(contents);
}

export function calculateGeoidHeight(model: GeoidModel, lon: number, lat: number): number {
  return bilinearInterpolate(
    model,
    lon,
    lat,
    model.glomn,
    model.glamn,
  );
}

const MODEL_CACHE: { [key: string]: GeoidModel } = {};
export async function getGeoidModel(filename: string): Promise<GeoidModel> {
  let cachedModel = MODEL_CACHE[filename];
  if (!cachedModel) {
    cachedModel = await loadJSONGeoidModel(path.join(
      __dirname, '..', '..', 'data', filename,
    ));
    cachedModel[filename] = cachedModel;
  }
  return cachedModel;
}

function bilinearInterpolate(model: GeoidModel, XPT: number, YPT: number, XMIN: number, YMIN: number): number {
  // double DX,DY,X,Y;
  // float el2,xx,yy;
  // int IX,IY,JX,JY,IADX,IADY;
  // el2 = 0.00001;
  // DX=1.5/60.0;
  // DY=1.0/60.0;
  // IX=(int)((XPT-XMIN)/DX)+1;
  // IY=(int)((YPT-YMIN)/DY)+1;
  // X=(XPT-XMIN)/DX-(IX-1);
  // Y=(YPT-YMIN)/DY-(IY-1);
  // JX=IX+1;
  // JY=IY+1;

  let el2 = 0.00001;
  let DX = 1.5 / 60.0;
  let DY = 1.0 / 60.0;
  let IX = Math.floor((XPT - XMIN) / DX) + 1;
  let IY = Math.floor((YPT - YMIN) / DY) + 1;
  let X = (XPT - XMIN) / DX - (IX - 1);
  let Y = (YPT - YMIN) / DY - (IY - 1);
  let JX = IX + 1;
  let JY = IY + 1;

  // // -------- check if the point is out of the data area
  // if((IX < 0) || (IX >= 1201) || (IY < 0) || (IY >= 1801)){
  //  printf("error:out of data area\n");
  //  *Z=999.0;
  //  return;
  // }
  if ((IX < 0) || (IX >= 1201) || (IY < 0) || (IY >= 1801)) {
    return 999.0;
  }

  // -------- check if the point is on the grid point or on a grid line
  // yy =fabs(Y);
  // xx =fabs(X);
  // IADX=99;
  // IADY=99;
  // if(yy<el2){
  //  IADY=0;
  // }else if((1.0-yy) < el2){
  //  IADY=1;
  // }
  // if(xx < el2){
  //  IADX=0;
  // }else if((1.0-xx) < el2){
  //  IADX=1;
  // }
  let yy = Math.abs(Y);
  let xx = Math.abs(X);
  let IADX = 99;
  let IADY = 99;
  if (yy < el2) {
    IADY = 0;
  } else if ((1.0 - yy) < el2) {
    IADY = 1;
  }
  if (xx < el2) {
    IADX = 0;
  } else if ((1.0 - xx) < el2) {
    IADX = 1;
  }

  if (IADY < 10) {
    // -----------  the point is on the grid
    if (IADX < 10) {
      return model.dat[IY+IADY][IX+IADY];
    }
    // -----------  the point is on the meridian cell line
    // if (((*dat)[IY+IADY][IX] == 999.0) || ((*dat)[IY+IADY][JX]==999.0)){
    if (model.dat[IY+IADY][IX] == 999.0 || model.dat[IY+IADY][JX] == 999.0) {
      return 999.0;
    } else {
      return (1.0 - X) * model.dat[IY+IADY][IX] + X * model.dat[IY+IADY][JX];
    }
  } else if (IADX < 10) {
    // -----------  the point is on the parallel cell line
    // if (((*dat)[IY][IX+IADX] == 999.0) || ((*dat)[JY][IX+IADX]==999.0)){
    if (model.dat[IY][IX+IADX] == 999.0 || model.dat[JY][IX+IADX] == 999.0) {
      return 999.0;
    } else {
      return (1.0 - Y) * model.dat[IY][IX+IADX] + Y * model.dat[JY][IX+IADX];
    }
  }

  // ------------- process for the point which is not on the grid lines
  // if ((((*dat)[JY][IX]==999.0) || ((*dat)[JY][JX]==999.0)) ||
  //  ((*dat)[IY][IX]==999.0) || ((*dat)[IY][JX]==999.0)){
  //  printf("error:non significant data area\n");
  //  *Z=999.0;
  // }else{
  //  *Z=(1.0-X)*(1.0-Y)*(*dat)[IY][IX]+Y*(1.0-X)*(*dat)[JY][IX]+X*(1.0-Y)*
  //    (*dat)[IY][JX]+(*dat)[JY][JX]*X*Y;
  // }

  if (
    (model.dat[JY][IX] == 999.0 || model.dat[JY][JX] == 999.0) ||
    (model.dat[IY][IX] == 999.0 || model.dat[IY][JX] == 999.0)
  ) {
    return 999.0;
  } else {
    return (1.0 - X) * (1.0 - Y) * model.dat[IY][IX] + Y * (1.0 - X) * model.dat[JY][IX] + X * (1.0 - Y) * model.dat[IY][JX] + model.dat[JY][JX] * X * Y;
  }
}
