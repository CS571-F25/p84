/**
 * Client for communicating with cards web worker
 *
 * Uses SharedWorker when available (desktop browsers) to share card data across tabs.
 * Gracefully falls back to regular Worker on unsupported browsers (mainly Chrome Android).
 *
 * Workers are imported using Vite's query suffix syntax (?worker and ?sharedworker)
 */

import * as Comlink from "comlink";
import type { CardsWorkerAPI } from "../workers/cards.worker";
import CardsSharedWorker from "../workers/cards.worker?sharedworker";
import CardsWorker from "../workers/cards.worker?worker";

let workerInstance: Comlink.Remote<CardsWorkerAPI> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Detect if SharedWorker is supported
 */
function isSharedWorkerSupported(): boolean {
	// Disable SharedWorker in development to avoid stale worker issues
	if (import.meta.env.DEV) return false;
	return typeof SharedWorker !== "undefined" && !process.env.VITEST;
}

/**
 * Get or create the cards worker instance
 *
 * On desktop (Chrome/Firefox/Safari): creates SharedWorker, shared across tabs
 * On mobile Chrome: creates regular Worker, per-tab instance
 */
function getWorker(): Comlink.Remote<CardsWorkerAPI> {
	if (!workerInstance) {
		if (isSharedWorkerSupported()) {
			// SharedWorker mode: shared across tabs
			console.log(
				"[CardsWorker] Using SharedWorker (card data shared across tabs)",
			);
			const sharedWorker = new CardsSharedWorker();
			workerInstance = Comlink.wrap<CardsWorkerAPI>(sharedWorker.port);
		} else {
			// Regular Worker mode: per-tab fallback
			console.log(
				"[CardsWorker] Using Worker (per-tab, SharedWorker not supported)",
			);
			const worker = new CardsWorker();
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
