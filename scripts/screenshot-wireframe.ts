/**
 * Screenshot wireframe comparison tool.
 *
 * Takes a Scryfall card ID, screenshots the wireframe component,
 * and downloads the real card image for side-by-side comparison.
 *
 * Usage:
 *   npm run screenshot:wireframe -- <card-id>
 *
 * Output:
 *   .cache/wireframe-compare/<card-id>-wireframe.png
 *   .cache/wireframe-compare/<card-id>-scryfall.png
 *
 * Requires dev server running on port 3000.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const DEV_SERVER_URL = "http://localhost:3000";
const OUTPUT_DIR = ".cache/wireframe-compare";

async function main() {
	const cardId = process.argv[2];

	if (!cardId) {
		console.error("Usage: npm run screenshot:wireframe -- <card-id>");
		console.error(
			"Example: npm run screenshot:wireframe -- 5e3f2736-9d13-44e3-a4bf-4f64314e5848",
		);
		process.exit(1);
	}

	// Ensure output directory exists
	if (!existsSync(OUTPUT_DIR)) {
		mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	console.log(`Processing card: ${cardId}`);

	// Fetch card data from Scryfall to get image URL
	console.log("Fetching card data from Scryfall...");
	const scryfallResponse = await fetch(
		`https://api.scryfall.com/cards/${cardId}`,
	);
	if (!scryfallResponse.ok) {
		console.error(
			`Failed to fetch card from Scryfall: ${scryfallResponse.status}`,
		);
		process.exit(1);
	}
	const cardData = (await scryfallResponse.json()) as {
		name: string;
		image_uris?: { normal: string };
		card_faces?: Array<{ image_uris?: { normal: string } }>;
	};

	console.log(`Card: ${cardData.name}`);

	// Get image URL (handle double-faced cards)
	const imageUrl =
		cardData.image_uris?.normal ?? cardData.card_faces?.[0]?.image_uris?.normal;

	if (!imageUrl) {
		console.error("Could not find image URL for card");
		process.exit(1);
	}

	// Download Scryfall image
	console.log("Downloading Scryfall image...");
	const imageResponse = await fetch(imageUrl);
	if (!imageResponse.ok) {
		console.error(`Failed to download image: ${imageResponse.status}`);
		process.exit(1);
	}
	const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
	const scryfallPath = `${OUTPUT_DIR}/${cardId}-scryfall.png`;
	writeFileSync(scryfallPath, imageBuffer);
	console.log(`Saved: ${scryfallPath}`);

	// Screenshot wireframe
	console.log("Launching browser...");
	const browser = await chromium.launch();
	const page = await browser.newPage();

	const wireframeUrl = `${DEV_SERVER_URL}/components/wireframe/${cardId}`;
	console.log(`Navigating to: ${wireframeUrl}`);

	try {
		await page.goto(wireframeUrl, { timeout: 30000 });

		// Wait for the card to load (look for data-card-loaded attribute)
		await page.waitForSelector('[data-card-loaded="true"]', { timeout: 10000 });

		// Give a moment for any animations/transitions
		await page.waitForTimeout(500);

		// Screenshot just the card container
		const wireframePath = `${OUTPUT_DIR}/${cardId}-wireframe.png`;
		await page.screenshot({
			path: wireframePath,
			fullPage: false,
		});
		console.log(`Saved: ${wireframePath}`);
	} catch (error) {
		console.error("Failed to screenshot wireframe. Is the dev server running?");
		console.error(error);
		await browser.close();
		process.exit(1);
	}

	await browser.close();

	console.log("\nDone! Compare the images:");
	console.log(`  Wireframe: ${OUTPUT_DIR}/${cardId}-wireframe.png`);
	console.log(`  Scryfall:  ${OUTPUT_DIR}/${cardId}-scryfall.png`);
}

main();
