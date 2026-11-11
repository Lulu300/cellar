import { getProducerDetails, producerHandlers } from '#lib/server/features/producers/service.js';
import { apiHandler } from '#lib/server/http/handler.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiHandler(({ params }) =>
    Response.json(getProducerDetails(params.id))
);

// 409 in_use, with their count, while wines use it
export const { PUT, DELETE } = producerHandlers.item;
