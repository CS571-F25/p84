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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const DEV_SERVER_URL = "http://localhost:3000";
const OUTPUT_DIR = ".cache/wireframe-compare";

async function createOverlay(
	page: Awaited<
		ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
	>,
	scryfallPath: string,
	wireframePath: string,
	outputPath: string,
	opacity = 0.5,
): Promise<void> {
	// Read images as base64
	const scryfallBase64 = readFileSync(scryfallPath).toString("base64");
	const wireframeBase64 = readFileSync(wireframePath).toString("base64");

	// Create HTML page with canvas compositing
	const html = `
		<!DOCTYPE html>
		<html>
		<head><style>body { margin: 0; }</style></head>
		<body>
			<canvas id="canvas"></canvas>
			<script>
				async function composite() {
					const canvas = document.getElementById('canvas');
					const ctx = canvas.getContext('2d');

					const scryfall = new Image();
					const wireframe = new Image();

					await Promise.all([
						new Promise(r => { scryfall.onload = r; scryfall.src = 'data:image/png;base64,${scryfallBase64}'; }),
						new Promise(r => { wireframe.onload = r; wireframe.src = 'data:image/png;base64,${wireframeBase64}'; })
					]);

					// Use scryfall dimensions
					canvas.width = scryfall.width;
					canvas.height = scryfall.height;

					// Draw scryfall at full opacity
					ctx.drawImage(scryfall, 0, 0);

					// Draw wireframe scaled to match, with transparency
					ctx.globalAlpha = ${opacity};
					ctx.drawImage(wireframe, 0, 0, canvas.width, canvas.height);

					document.body.setAttribute('data-ready', 'true');
				}
				composite();
			</script>
		</body>
		</html>
	`;

	await page.setContent(html);
	await page.waitForSelector("[data-ready]", { timeout: 5000 });

	const canvas = await page.$("#canvas");
	if (canvas) {
		await canvas.screenshot({ path: outputPath });
	}
}

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

	// Check if there's a flip button (different labels for flip vs transform cards)
	const flipButton = await page.$(
		'button[aria-label="Flip card"], button[aria-label="Transform card"]',
	);
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
	// Detect if input is a UUID or a card name
	const isUuid =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			cardId,
		);
	const scryfallUrl = isUuid
		? `https://api.scryfall.com/cards/${cardId}`
		: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardId)}`;

	console.log("Fetching card data from Scryfall...");
	const scryfallResponse = await fetch(scryfallUrl);
	if (!scryfallResponse.ok) {
		console.error(
			`Failed to fetch card from Scryfall: ${scryfallResponse.status}`,
		);
		process.exit(1);
	}
	const cardData = (await scryfallResponse.json()) as {
		id: string;
		name: string;
		image_uris?: { normal: string };
		card_faces?: Array<{ image_uris?: { normal: string } }>;
	};

	// Use the actual ID from API (important when searching by name)
	const actualId = cardData.id;
	console.log(`Card: ${cardData.name} (${actualId})`);

	// Download all Scryfall images (front and back for DFCs)
	console.log("Downloading Scryfall images...");
	if (cardData.image_uris?.normal) {
		// Single-faced card
		const imageResponse = await fetch(cardData.image_uris.normal);
		if (imageResponse.ok) {
			const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
			const scryfallPath = `${OUTPUT_DIR}/${actualId}-scryfall.png`;
			writeFileSync(scryfallPath, imageBuffer);
			console.log(`  scryfall: ${scryfallPath}`);
		}
	} else if (cardData.card_faces) {
		// Multi-faced card - download all faces
		for (let i = 0; i < cardData.card_faces.length; i++) {
			const face = cardData.card_faces[i];
			if (face.image_uris?.normal) {
				const imageResponse = await fetch(face.image_uris.normal);
				if (imageResponse.ok) {
					const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
					const suffix = i === 0 ? "" : `-face${i + 1}`;
					const scryfallPath = `${OUTPUT_DIR}/${actualId}-scryfall${suffix}.png`;
					writeFileSync(scryfallPath, imageBuffer);
					console.log(`  scryfall${suffix}: ${scryfallPath}`);
				}
			}
		}
	}

	// Screenshot wireframe in both modes
	console.log("Screenshotting wireframes...");
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const wireframeUrl = `${DEV_SERVER_URL}/components/wireframe/${actualId}`;

	try {
		// Light mode
		await screenshotMode(page, actualId, wireframeUrl, false);
		// Dark mode
		await screenshotMode(page, actualId, wireframeUrl, true);
	} catch (error) {
		console.error("Failed to screenshot wireframe. Is the dev server running?");
		console.error(error);
		await browser.close();
		process.exit(1);
	}

	// Create overlay images
	console.log("Creating overlay comparisons...");
	const scryfallPath = `${OUTPUT_DIR}/${actualId}-scryfall.png`;
	const wireframePath = `${OUTPUT_DIR}/${actualId}-wireframe.png`;

	if (existsSync(scryfallPath) && existsSync(wireframePath)) {
		const overlayPath = `${OUTPUT_DIR}/${actualId}-overlay.png`;
		await createOverlay(page, scryfallPath, wireframePath, overlayPath, 0.5);
		console.log(`  overlay: ${overlayPath}`);
	}

	// Also create overlay for back face if it exists
	const scryfallFace2Path = `${OUTPUT_DIR}/${actualId}-scryfall-face2.png`;
	const wireframeFlippedPath = `${OUTPUT_DIR}/${actualId}-wireframe-flipped.png`;

	if (existsSync(scryfallFace2Path) && existsSync(wireframeFlippedPath)) {
		const overlayPath = `${OUTPUT_DIR}/${actualId}-overlay-face2.png`;
		await createOverlay(
			page,
			scryfallFace2Path,
			wireframeFlippedPath,
			overlayPath,
			0.5,
		);
		console.log(`  overlay (face2): ${overlayPath}`);
	}

	await browser.close();

	console.log("\nDone! Files saved to .cache/wireframe-compare/");
}

main();
