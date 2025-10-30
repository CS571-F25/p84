/**
 * Application initialization
 * Run once on client-side startup to initialize OAuth and worker
 */

import { initializeWorker } from "./cards-worker-client";
import { initializeOAuth } from "./oauth-config";

export function initializeApp() {
	if (typeof window === "undefined") return;

	initializeOAuth();
	initializeWorker();
}
