/**
 * Client for communicating with cards web worker
 *
 * Uses SharedWorker when available (desktop browsers) to share card data across tabs.
 * Gracefully falls back to regular Worker on unsupported browsers (mainly Chrome Android).
 */

import * as Comlink from "comlink";
import type { CardsWorkerAPI } from "../workers/cards.worker";

let workerInstance: Comlink.Remote<CardsWorkerAPI> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Detect if SharedWorker is supported
 */
function isSharedWorkerSupported(): boolean {
	return typeof SharedWorker !== "undefined";
}

/**
 * Get or create the cards worker instance
 *
 * On desktop (Chrome/Firefox/Safari): creates SharedWorker, shared across tabs
 * On mobile Chrome: creates regular Worker, per-tab instance
 */
function getWorker(): Comlink.Remote<CardsWorkerAPI> {
	if (!workerInstance) {
		const workerUrl = new URL("../workers/cards.worker.ts", import.meta.url);

		if (isSharedWorkerSupported()) {
			// SharedWorker mode: shared across tabs
			console.log(
				"[CardsWorker] Using SharedWorker (card data shared across tabs)",
			);
			const sharedWorker = new SharedWorker(workerUrl, { type: "module" });
			workerInstance = Comlink.wrap<CardsWorkerAPI>(sharedWorker.port);
		} else {
			// Regular Worker mode: per-tab fallback
			console.log(
				"[CardsWorker] Using Worker (per-tab, SharedWorker not supported)",
			);
			const worker = new Worker(workerUrl, { type: "module" });
			workerInstance = Comlink.wrap<CardsWorkerAPI>(worker);
		}
	}
	return workerInstance;
}

/**
 * Initialize the worker (idempotent - safe to call multiple times)
 */
export async function initializeWorker(): Promise<void> {
	if (!initPromise) {
		initPromise = getWorker().initialize();
	}
	return initPromise;
}

/**
 * Get the initialized worker API
 */
export function getCardsWorker(): Comlink.Remote<CardsWorkerAPI> {
	return getWorker();
}
