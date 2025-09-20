// /server/api/proxy-image.ts

import {createError, defineEventHandler, getQuery, setHeaders} from "h3";

export default defineEventHandler(async (event) => {
    const imageUrl = getQuery(event).url;

    if (!imageUrl) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Image URL is required'
        });
    }

    try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw createError({
                statusCode: response.status,
                statusMessage: 'Failed to fetch image from external source'
            });
        }

        const contentType = response.headers.get('content-type');
        setHeaders(event, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable' // Good for caching
        });

        return response.body;
    } catch (error) {
        console.error('Proxy image error:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error'
        });
    }
});
