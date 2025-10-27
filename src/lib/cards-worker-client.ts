/**
 * Client for communicating with cards web worker
 */

import * as Comlink from "comlink";
import type { CardsWorkerAPI } from "../workers/cards.worker";

let workerInstance: Comlink.Remote<CardsWorkerAPI> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Get or create the cards worker instance
 */
function getWorker(): Comlink.Remote<CardsWorkerAPI> {
	if (!workerInstance) {
		const worker = new Worker(
			new URL("../workers/cards.worker.ts", import.meta.url),
			{ type: "module" },
		);
		workerInstance = Comlink.wrap<CardsWorkerAPI>(worker);
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
