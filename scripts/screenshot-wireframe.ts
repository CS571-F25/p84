/**
 * Screenshot wireframe comparison tool.
 *
 * Takes a Scryfall card ID, screenshots the wireframe component in both
 * light and dark modes, and downloads the real card image for comparison.
 *
 * Usage:
 *   npm run screenshot:wireframe -- <card-id>
 *
 * Output:
 *   .cache/wireframe-compare/<card-id>-wireframe.png      (light mode)
 *   .cache/wireframe-compare/<card-id>-wireframe-dark.png (dark mode)
 *   .cache/wireframe-compare/<card-id>-scryfall.png       (real card)
 *
 * Requires dev server running on port 3000.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const DEV_SERVER_URL = "http://localhost:3000";
const OUTPUT_DIR = ".cache/wireframe-compare";

async function screenshotMode(
	page: Awaited<
		ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
	>,
	cardId: string,
	wireframeUrl: string,
	darkMode: boolean,
): Promise<boolean> {
	const suffix = darkMode ? "-dark" : "";
	const modeName = darkMode ? "dark" : "light";

	// Set color scheme
	await page.emulateMedia({ colorScheme: darkMode ? "dark" : "light" });

	await page.goto(wireframeUrl, { timeout: 30000 });

	// Set dark class if needed
	if (darkMode) {
		await page.evaluate(() => {
			document.documentElement.classList.add("dark");
		});
	} else {
		await page.evaluate(() => {
			document.documentElement.classList.remove("dark");
		});
	}

	// Wait for the card to load
	await page.waitForSelector('[data-card-loaded="true"]', { timeout: 10000 });
	await page.waitForTimeout(300);

	// Screenshot the card element
	const wireframePath = `${OUTPUT_DIR}/${cardId}-wireframe${suffix}.png`;
	const cardElement = await page.$("[data-wireframe-target]");
	if (!cardElement) {
		throw new Error("Could not find wireframe target element");
	}
	await cardElement.screenshot({ path: wireframePath });
	console.log(`  ${modeName}: ${wireframePath}`);

	// Check if there's a flip button
	const flipButton = await page.$('button[aria-label="Flip card"]');
	if (flipButton) {
		// Click to flip and screenshot the flipped state
		await flipButton.click();
		await page.waitForTimeout(600); // Wait for flip animation

		const flippedPath = `${OUTPUT_DIR}/${cardId}-wireframe${suffix}-flipped.png`;
		await cardElement.screenshot({ path: flippedPath });
		console.log(`  ${modeName} (flipped): ${flippedPath}`);
		return true;
	}
	return false;
}

async function main() {
	const args = process.argv.slice(2);
	const cardId = args.find((a) => !a.startsWith("--"));

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

	// Fetch card data from Scryfall
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
	console.log(`  scryfall: ${scryfallPath}`);

	// Screenshot wireframe in both modes
	console.log("Screenshotting wireframes...");
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const wireframeUrl = `${DEV_SERVER_URL}/components/wireframe/${cardId}`;

	try {
		// Light mode
		await screenshotMode(page, cardId, wireframeUrl, false);
		// Dark mode
		await screenshotMode(page, cardId, wireframeUrl, true);
	} catch (error) {
		console.error("Failed to screenshot wireframe. Is the dev server running?");
		console.error(error);
		await browser.close();
		process.exit(1);
	}

	await browser.close();

	console.log("\nDone! Files saved to .cache/wireframe-compare/");
}

main();
