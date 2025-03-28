import { formatErrorResponse } from "../libs/api-gateway";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import * as dem from "../tilesets/dem";
import * as geoid from "../tilesets/geoid";

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.routeKey === 'GET /jgsi-dem/tiles.json') {
    return await dem.metaHandler(event);
  } else if (event.routeKey === 'GET /jgsi-dem/tiles/{z}/{x}/{y}') {
    return await dem.tileHandler(event);
  } else if (event.routeKey === 'GET /jgsi-dem/cross-section') {
    return await dem.crossSectionHandler(event);
  } else if (event.routeKey === 'GET /geoid/tiles.json') {
    return await geoid.metaHandler(event);
  } else if (event.routeKey === 'GET /geoid/tiles/{z}/{x}/{y}') {
    return await geoid.tileHandler(event);
  }

  return formatErrorResponse(404, "not found");
};
