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
import sharp from "sharp";

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

interface AlignmentResult {
	region: string;
	dx: number;
	dy: number;
	dxPercent: string;
	dyPercent: string;
	direction: string;
}

/**
 * Computes optimal shift to align wireframe with scryfall using cross-correlation.
 * Returns shift needed for wireframe to match scryfall.
 */
async function computeAlignment(
	scryfallPath: string,
	wireframePath: string,
	regions: Record<string, { x: number; y: number; w: number; h: number }>,
): Promise<AlignmentResult[]> {
	// Load images and get raw pixel data
	const scryfallImg = sharp(scryfallPath);
	const wireframeImg = sharp(wireframePath);

	const { width, height } = await scryfallImg.metadata();
	if (!width || !height) throw new Error("Could not read image dimensions");

	// Resize wireframe to match scryfall dimensions
	const scryfallRaw = await scryfallImg.grayscale().raw().toBuffer();
	const wireframeRaw = await wireframeImg
		.resize(width, height)
		.grayscale()
		.raw()
		.toBuffer();

	const results: AlignmentResult[] = [];

	const h = height; // local const for closure
	for (const [regionName, region] of Object.entries(regions)) {
		const rx = Math.floor(width * region.x);
		const ry = Math.floor(h * region.y);
		const rw = Math.floor(width * region.w);
		const rh = Math.floor(h * region.h);

		// Extract region and compute edges (simple gradient)
		function getEdges(raw: Buffer, imgWidth: number): number[] {
			const edges: number[] = [];
			for (let y = 0; y < rh; y++) {
				for (let x = 0; x < rw; x++) {
					const imgX = rx + x;
					const imgY = ry + y;
					if (imgX <= 0 || imgX >= imgWidth - 1 || imgY <= 0 || imgY >= h - 1) {
						edges.push(0);
						continue;
					}
					const idx = imgY * imgWidth + imgX;
					const gx = raw[idx + 1] - raw[idx - 1];
					const gy = raw[idx + imgWidth] - raw[idx - imgWidth];
					edges.push(Math.sqrt(gx * gx + gy * gy));
				}
			}
			return edges;
		}

		const scryfallEdges = getEdges(scryfallRaw, width);
		const wireframeEdges = getEdges(wireframeRaw, width);

		// Search for best shift
		const searchRange = 15;
		let bestDx = 0;
		let bestDy = 0;
		let bestScore = -Infinity;

		for (let dy = -searchRange; dy <= searchRange; dy++) {
			for (let dx = -searchRange; dx <= searchRange; dx++) {
				let sum = 0;
				let count = 0;

				for (let y = searchRange; y < rh - searchRange; y++) {
					for (let x = searchRange; x < rw - searchRange; x++) {
						const scryfallVal = scryfallEdges[y * rw + x];
						const wy = y + dy;
						const wx = x + dx;
						if (wy >= 0 && wy < rh && wx >= 0 && wx < rw) {
							const wireframeVal = wireframeEdges[wy * rw + wx];
							sum += scryfallVal * wireframeVal;
							count++;
						}
					}
				}

				const score = count > 0 ? sum / count : 0;
				if (score > bestScore) {
					bestScore = score;
					bestDx = dx;
					bestDy = dy;
				}
			}
		}

		// Direction description (inverted because we found how much wireframe is offset FROM target)
		const dirs: string[] = [];
		if (bestDy > 0) dirs.push(`UP ${bestDy}px`);
		if (bestDy < 0) dirs.push(`DOWN ${-bestDy}px`);
		if (bestDx > 0) dirs.push(`LEFT ${bestDx}px`);
		if (bestDx < 0) dirs.push(`RIGHT ${-bestDx}px`);

		results.push({
			region: regionName,
			dx: bestDx,
			dy: bestDy,
			dxPercent: ((bestDx / width) * 100).toFixed(2),
			dyPercent: ((bestDy / height) * 100).toFixed(2),
			direction:
				dirs.length > 0 ? `Move wireframe ${dirs.join(", ")}` : "Aligned",
		});
	}

	return results;
}

/**
 * Creates zoomed crops of key card regions for easier alignment analysis.
 * Outputs separate images for: P/T box, title bar, mana cost, type line
 */
async function createZoomedCrops(
	page: Awaited<
		ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
	>,
	channelImagePath: string,
	outputPrefix: string,
): Promise<void> {
	const channelBase64 = readFileSync(channelImagePath).toString("base64");

	const html = `
		<!DOCTYPE html>
		<html>
		<head><style>body { margin: 0; background: #222; } canvas { display: block; margin: 10px; }</style></head>
		<body>
			<canvas id="pt"></canvas>
			<canvas id="title"></canvas>
			<canvas id="mana"></canvas>
			<canvas id="typeText"></canvas>
			<canvas id="setSymbol"></canvas>
			<script>
				async function crop() {
					const img = new Image();
					await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,${channelBase64}'; });

					const w = img.width;
					const h = img.height;

					// Define crop regions as percentages of card dimensions
					const regions = {
						pt: { x: 0.65, y: 0.85, w: 0.35, h: 0.15 },      // bottom right
						title: { x: 0, y: 0, w: 0.7, h: 0.12 },           // top bar title only
						mana: { x: 0.7, y: 0.02, w: 0.28, h: 0.08 },      // mana symbols tight
						typeText: { x: 0, y: 0.56, w: 0.6, h: 0.07 },     // type text only
						setSymbol: { x: 0.8, y: 0.56, w: 0.18, h: 0.07 }, // set symbol tight
					};

					const scale = 3; // 3x zoom

					for (const [name, r] of Object.entries(regions)) {
						const canvas = document.getElementById(name);
						const cropW = Math.floor(w * r.w);
						const cropH = Math.floor(h * r.h);
						canvas.width = cropW * scale;
						canvas.height = cropH * scale;

						const ctx = canvas.getContext('2d');
						ctx.imageSmoothingEnabled = false;
						ctx.drawImage(
							img,
							Math.floor(w * r.x), Math.floor(h * r.y), cropW, cropH,
							0, 0, cropW * scale, cropH * scale
						);
					}

					document.body.setAttribute('data-ready', 'true');
				}
				crop();
			</script>
		</body>
		</html>
	`;

	await page.setContent(html);
	await page.waitForSelector("[data-ready]", { timeout: 5000 });

	// Save each cropped region
	for (const name of ["pt", "title", "mana", "typeText", "setSymbol"]) {
		const canvas = await page.$(`#${name}`);
		if (canvas) {
			await canvas.screenshot({ path: `${outputPrefix}-zoom-${name}.png` });
		}
	}
}

/**
 * Creates a red/blue channel comparison image.
 * - Scryfall card goes in the BLUE channel
 * - Wireframe goes in the RED channel
 * - Perfect alignment = magenta/purple
 * - Red above blue = wireframe is too HIGH
 * - Blue above red = wireframe is too LOW
 */
async function createChannelComparison(
	page: Awaited<
		ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
	>,
	scryfallPath: string,
	wireframePath: string,
	outputPath: string,
): Promise<void> {
	const scryfallBase64 = readFileSync(scryfallPath).toString("base64");
	const wireframeBase64 = readFileSync(wireframePath).toString("base64");

	const html = `
		<!DOCTYPE html>
		<html>
		<head><style>body { margin: 0; background: #888; }</style></head>
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

					// Create temp canvases to get image data
					const scryfallCanvas = document.createElement('canvas');
					scryfallCanvas.width = canvas.width;
					scryfallCanvas.height = canvas.height;
					const scryfallCtx = scryfallCanvas.getContext('2d');
					scryfallCtx.drawImage(scryfall, 0, 0);

					const wireframeCanvas = document.createElement('canvas');
					wireframeCanvas.width = canvas.width;
					wireframeCanvas.height = canvas.height;
					const wireframeCtx = wireframeCanvas.getContext('2d');
					wireframeCtx.drawImage(wireframe, 0, 0, canvas.width, canvas.height);

					// Get pixel data
					const scryfallData = scryfallCtx.getImageData(0, 0, canvas.width, canvas.height);
					const wireframeData = wireframeCtx.getImageData(0, 0, canvas.width, canvas.height);
					const outputData = ctx.createImageData(canvas.width, canvas.height);
					const w = canvas.width;
					const h = canvas.height;

					// Helper to get luminance at pixel
					function getLum(data, x, y) {
						if (x < 0 || x >= w || y < 0 || y >= h) return 128;
						const i = (y * w + x) * 4;
						return data.data[i] * 0.299 + data.data[i+1] * 0.587 + data.data[i+2] * 0.114;
					}

					// Edge detection with 3x3 kernel for thicker edges
					function getEdge(data, x, y) {
						let maxEdge = 0;
						for (let dy = -1; dy <= 1; dy++) {
							for (let dx = -1; dx <= 1; dx++) {
								const gx = getLum(data, x+dx+1, y+dy) - getLum(data, x+dx-1, y+dy);
								const gy = getLum(data, x+dx, y+dy+1) - getLum(data, x+dx, y+dy-1);
								maxEdge = Math.max(maxEdge, Math.sqrt(gx*gx + gy*gy));
							}
						}
						return Math.min(255, maxEdge * 1.5);
					}

					// Combine edges: wireframe -> red/orange, scryfall -> cyan
					for (let y = 0; y < h; y++) {
						for (let x = 0; x < w; x++) {
							const i = (y * w + x) * 4;
							const scryfallEdge = getEdge(scryfallData, x, y);
							const wireframeEdge = getEdge(wireframeData, x, y);

							// Dark background, boosted red for wireframe, cyan for scryfall
							const base = 25;
							outputData.data[i] = base + wireframeEdge;           // R - wireframe (full)
							outputData.data[i+1] = base + wireframeEdge * 0.3 + scryfallEdge * 0.9;  // G - orange tint + cyan
							outputData.data[i+2] = base + scryfallEdge * 0.9;    // B - scryfall (cyan)
							outputData.data[i+3] = 255;
						}
					}

					ctx.putImageData(outputData, 0, 0);
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

/**
 * Creates zoomed crops of key card regions from the wireframe itself (not comparison).
 * Useful for inspecting fine details like footer text.
 */
async function createWireframeZooms(
	wireframePath: string,
	outputPrefix: string,
): Promise<void> {
	const regions = {
		title: { x: 0, y: 0, w: 1, h: 0.12 },
		type: { x: 0, y: 0.54, w: 1, h: 0.1 },
		footer: { x: 0, y: 0.88, w: 1, h: 0.12 },
		pt: { x: 0.6, y: 0.8, w: 0.4, h: 0.2 },
	};

	const img = sharp(wireframePath);
	const { width, height } = await img.metadata();
	if (!width || !height) throw new Error("Could not read wireframe dimensions");

	for (const [name, r] of Object.entries(regions)) {
		const left = Math.floor(width * r.x);
		const top = Math.floor(height * r.y);
		const cropWidth = Math.floor(width * r.w);
		const cropHeight = Math.floor(height * r.h);

		await sharp(wireframePath)
			.extract({ left, top, width: cropWidth, height: cropHeight })
			.resize(cropWidth * 3, cropHeight * 3, { kernel: "nearest" })
			.toFile(`${outputPrefix}-wireframe-zoom-${name}.png`);
	}
}

async function main() {
	const args = process.argv.slice(2);
	const cardId = args.find((a) => !a.startsWith("--"));
	const doZoom = args.includes("--zoom");

	if (!cardId) {
		console.error("Usage: npm run screenshot:wireframe -- <card-id> [--zoom]");
		console.error(
			"Example: npm run screenshot:wireframe -- 5e3f2736-9d13-44e3-a4bf-4f64314e5848",
		);
		console.error("  --zoom: Create zoomed crops of wireframe regions");
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

		// Red/blue channel comparison (red=wireframe, blue=scryfall)
		const channelPath = `${OUTPUT_DIR}/${actualId}-channels.png`;
		await createChannelComparison(
			page,
			scryfallPath,
			wireframePath,
			channelPath,
		);
		console.log(`  channels: ${channelPath}`);

		// Zoomed crops of key regions
		await createZoomedCrops(page, channelPath, `${OUTPUT_DIR}/${actualId}`);
		console.log(`  zooms: pt, title, mana, type`);

		// Compute alignment shifts
		const regions = {
			pt: { x: 0.65, y: 0.85, w: 0.35, h: 0.15 },
			title: { x: 0, y: 0, w: 0.7, h: 0.12 },
			mana: { x: 0.7, y: 0.02, w: 0.28, h: 0.08 },
			typeText: { x: 0, y: 0.56, w: 0.6, h: 0.07 },
			setSymbol: { x: 0.8, y: 0.56, w: 0.18, h: 0.07 },
		};
		console.log("\nAlignment analysis:");
		const alignments = await computeAlignment(
			scryfallPath,
			wireframePath,
			regions,
		);
		for (const a of alignments) {
			console.log(
				`  ${a.region}: ${a.direction} (${a.dxPercent}%, ${a.dyPercent}%)`,
			);
		}
	}

	// Create standalone wireframe zooms if requested
	if (doZoom && existsSync(wireframePath)) {
		console.log("Creating wireframe zooms...");
		await createWireframeZooms(wireframePath, `${OUTPUT_DIR}/${actualId}`);
		console.log(`  zooms: title, type, footer, pt`);
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

		const channelPath = `${OUTPUT_DIR}/${actualId}-channels-face2.png`;
		await createChannelComparison(
			page,
			scryfallFace2Path,
			wireframeFlippedPath,
			channelPath,
		);
		console.log(`  channels (face2): ${channelPath}`);
	}

	await browser.close();

	console.log("\nDone! Files saved to .cache/wireframe-compare/");
}

main();
