/**
 * Identity resolution utilities using Slingshot's resolveMiniDoc endpoint
 */

import type { Did } from "@atcute/lexicons";

export interface MiniDoc {
	did: Did;
	handle: string;
	pds: string;
	signing_key: string;
}

const SLINGSHOT_BASE = "https://slingshot.microcosm.blue";

/**
 * Resolve a handle or DID to a MiniDoc containing identity information
 * Uses Slingshot's cached identity resolver
 */
export async function resolveMiniDoc(identifier: string): Promise<MiniDoc> {
	const url = new URL(`${SLINGSHOT_BASE}/xrpc/com.bad-example.identity.resolveMiniDoc`);
	url.searchParams.set("identifier", identifier);

	const response = await fetch(url.toString());

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			error.message || `Failed to resolve identity: ${response.statusText}`,
		);
	}

	return response.json();
}

/**
 * Extract the PDS URL for a given DID
 * Useful for constructing direct PDS requests
 */
export async function getPdsForDid(did: Did): Promise<string> {
	const doc = await resolveMiniDoc(did);
	return doc.pds;
}

/**
 * Resolve a handle to its DID
 */
export async function resolveHandleToDid(handle: string): Promise<Did> {
	const doc = await resolveMiniDoc(handle);
	return doc.did;
}
