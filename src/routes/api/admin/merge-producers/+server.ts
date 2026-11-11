import { mergeProducers } from '#lib/server/features/producers/service.js';
import { parseBody } from '#lib/server/http/body.js';
import { apiHandler } from '#lib/server/http/handler.js';
import { producerMergeSchema } from '#lib/shared/schemas/producer.js';
import type { RequestHandler } from './$types';

// 409 merge_choice_needed, with the fields, while a field filled differently on both has no choice
export const POST: RequestHandler = apiHandler(async ({ request }) =>
    Response.json(mergeProducers(await parseBody(request, producerMergeSchema)))
);
