import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	XrpcHandleResolver,
} from "@atcute/identity-resolver";
import {
	configureOAuth,
	defaultIdentityResolver,
} from "@atcute/oauth-browser-client";

export function initializeOAuth() {
	if (typeof window === "undefined") {
		return;
	}

	configureOAuth({
		metadata: {
			client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
			redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
		},
		identityResolver: defaultIdentityResolver({
			handleResolver: new XrpcHandleResolver({
				serviceUrl: "https://public.api.bsky.app",
			}),
			didDocumentResolver: new CompositeDidDocumentResolver({
				methods: {
					plc: new PlcDidDocumentResolver(),
					web: new WebDidDocumentResolver(),
				},
			}),
		}),
	});
}
