import type { DidDocument } from "@atcute/identity";
import { getAtprotoHandle } from "@atcute/identity";
import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from "@atcute/identity-resolver";
import type { Did } from "@atcute/lexicons";
import { queryOptions } from "@tanstack/react-query";

const didResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

/**
 * Query options for resolving a DID document.
 * Consumers can use `select` to extract specific fields like the handle.
 */
export const didDocumentQueryOptions = (did: Did | null | undefined) =>
	queryOptions({
		queryKey: ["didDocument", did] as const,
		queryFn: async (): Promise<DidDocument | null> => {
			if (!did) return null;
			// Cast to satisfy composite resolver types (it accepts did:plc and did:web)
			return didResolver.resolve(
				did as `did:plc:${string}` | `did:web:${string}`,
			);
		},
		staleTime: 2 * 60 * 60 * 1000, // 2 hours
	});

/**
 * Helper to extract handle from DID document
 */
export function extractHandle(didDocument: DidDocument | null): string | null {
	if (!didDocument) return null;
	return getAtprotoHandle(didDocument) ?? null;
}
