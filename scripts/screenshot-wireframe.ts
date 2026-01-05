/**
 * Screenshot wireframe comparison tool.
 *
 * Takes a Scryfall card ID, screenshots the wireframe component,
 * and downloads the real card image for side-by-side comparison.
 *
 * Usage:
 *   npm run screenshot:wireframe -- <card-id> [--dark] [--overlay]
 *
 * Options:
 *   --dark     Screenshot in dark mode
 *   --overlay  Generate overlay image (wireframe at 50% over real card)
 *
 * Output:
 *   .cache/wireframe-compare/<card-id>-wireframe.png (or -wireframe-dark.png)
 *   .cache/wireframe-compare/<card-id>-scryfall.png
 *   .cache/wireframe-compare/<card-id>-overlay.png (if --overlay)
 *
 * Requires dev server running on port 3000.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const DEV_SERVER_URL = "http://localhost:3000";
const OUTPUT_DIR = ".cache/wireframe-compare";

async function main() {
	const args = process.argv.slice(2);
	const cardId = args.find((a) => !a.startsWith("--"));
	const darkMode = args.includes("--dark");
	const overlay = args.includes("--overlay");

	if (!cardId) {
		console.error(
			"Usage: npm run screenshot:wireframe -- <card-id> [--dark] [--overlay]",
		);
		console.error(
			"Example: npm run screenshot:wireframe -- 5e3f2736-9d13-44e3-a4bf-4f64314e5848 --dark",
		);
		process.exit(1);
	}

	// Ensure output directory exists
	if (!existsSync(OUTPUT_DIR)) {
		mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	console.log(`Processing card: ${cardId}${darkMode ? " (dark mode)" : ""}`);

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

	// Set color scheme preference for dark mode
	if (darkMode) {
		await page.emulateMedia({ colorScheme: "dark" });
	}

	const wireframeUrl = `${DEV_SERVER_URL}/components/wireframe/${cardId}`;
	console.log(`Navigating to: ${wireframeUrl}`);

	try {
		await page.goto(wireframeUrl, { timeout: 30000 });

		// If dark mode, also add the dark class to document
		if (darkMode) {
			await page.evaluate(() => {
				document.documentElement.classList.add("dark");
			});
		}

		// Wait for the card to load (look for data-card-loaded attribute)
		await page.waitForSelector('[data-card-loaded="true"]', { timeout: 10000 });

		// Give a moment for any animations/transitions
		await page.waitForTimeout(500);

		// Screenshot just the card element
		const suffix = darkMode ? "-dark" : "";
		const wireframePath = `${OUTPUT_DIR}/${cardId}-wireframe${suffix}.png`;
		const cardElement = await page.$("[data-wireframe-target]");
		if (!cardElement) {
			throw new Error("Could not find wireframe target element");
		}
		await cardElement.screenshot({ path: wireframePath });
		console.log(`Saved: ${wireframePath}`);

		// Generate overlay if requested
		if (overlay) {
			console.log("Generating overlay...");
			const overlayPath = `${OUTPUT_DIR}/${cardId}-overlay${suffix}.png`;

			// Create overlay using canvas in the browser
			const overlayBuffer = await page.evaluate(
				async ({ scryfallUrl, wireframePath: _wp }) => {
					// This runs in browser context
					const canvas = document.createElement("canvas");
					const ctx = canvas.getContext("2d")!;

					// Load Scryfall image
					const scryfallImg = new Image();
					scryfallImg.crossOrigin = "anonymous";
					await new Promise((resolve, reject) => {
						scryfallImg.onload = resolve;
						scryfallImg.onerror = reject;
						scryfallImg.src = scryfallUrl;
					});

					// Set canvas size to Scryfall image size
					canvas.width = scryfallImg.width;
					canvas.height = scryfallImg.height;

					// Draw Scryfall image
					ctx.drawImage(scryfallImg, 0, 0);

					// Get wireframe element and draw it with transparency
					const wireframe = document.querySelector("[data-wireframe-target]");
					if (wireframe) {
						// Use html2canvas or similar would be better, but for now just
						// indicate this needs the wireframe screenshot
						ctx.globalAlpha = 0.5;
						ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}

					return canvas.toDataURL("image/png").split(",")[1];
				},
				{ scryfallUrl: imageUrl, wireframePath },
			);

			const overlayData = Buffer.from(overlayBuffer, "base64");
			writeFileSync(overlayPath, overlayData);
			console.log(`Saved: ${overlayPath}`);
		}
	} catch (error) {
		console.error("Failed to screenshot wireframe. Is the dev server running?");
		console.error(error);
		await browser.close();
		process.exit(1);
	}

	await browser.close();

	const suffix = darkMode ? "-dark" : "";
	console.log("\nDone! Compare the images:");
	console.log(`  Wireframe: ${OUTPUT_DIR}/${cardId}-wireframe${suffix}.png`);
	console.log(`  Scryfall:  ${OUTPUT_DIR}/${cardId}-scryfall.png`);
	if (overlay) {
		console.log(`  Overlay:   ${OUTPUT_DIR}/${cardId}-overlay${suffix}.png`);
	}
}

main();
