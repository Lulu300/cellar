import type { RequestHandler } from './$types';
import { apiHandler } from '#lib/server/http/handler.js';
import { openApiDocument } from '#lib/server/openapi.js';

// Made by the code that writes docs/openapi.json rather than read from that file, which the Docker
// image leaves out: it describes the version that runs.
const description = openApiDocument();

export const GET: RequestHandler = apiHandler(() => Response.json(description));
