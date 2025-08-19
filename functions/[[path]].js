const HOP_BY_HOP = [
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade'
];

function stripHopByHopHeaders(input) {
	const h = new Headers();
	for (const [k, v] of input.entries()) h.set(k, v);
	for (const k of HOP_BY_HOP) h.delete(k);
	return h;
}

export default {
	async fetch(request, env) {
		const upstreamBase = env.UPSTREAM_BASE;
		if (!upstreamBase) return new Response('UPSTREAM_BASE not set', { status: 500 });

		const inUrl = new URL(request.url);
		const outUrl = new URL(upstreamBase);
		outUrl.pathname = inUrl.pathname;
		outUrl.search = inUrl.search;

		const reqHeaders = stripHopByHopHeaders(request.headers);
		reqHeaders.set('X-Forwarded-Host', inUrl.host);
		reqHeaders.set('X-Forwarded-Proto', inUrl.protocol.replace(':', ''));
		reqHeaders.set('Host', outUrl.host);
		// Optional upstream auth injection if client didn't send one
		if (!reqHeaders.has('Authorization')) {
			if (env.UPSTREAM_AUTH_HEADER) {
				reqHeaders.set('Authorization', env.UPSTREAM_AUTH_HEADER);
			} else if (env.UPSTREAM_BASIC_AUTH) {
				reqHeaders.set('Authorization', `Basic ${env.UPSTREAM_BASIC_AUTH}`);
			}
		}

		const init = {
			method: request.method,
			headers: reqHeaders,
			body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
			redirect: 'manual'
		};

		const upstreamResp = await fetch(outUrl.toString(), init);

		const respHeaders = stripHopByHopHeaders(upstreamResp.headers);
		return new Response(upstreamResp.body, { status: upstreamResp.status, headers: respHeaders });
	}
}; 
