import AxeBuilder from "@axe-core/playwright";
import { test } from "playwright/test";

// Test pages in both light and dark mode
const testPages = [
	{ name: "Home", path: "/" },
	{ name: "Card Search", path: "/cards?q=" },
	// Lightning Bolt - iconic card
	{ name: "Card: Lightning Bolt", path: "/card/3a9f0cf7-46c0-4a64-be65-a2c5b5f64e2c" },
	// Counterspell - another common card
	{ name: "Card: Counterspell", path: "/card/1920dae4-fb92-4f19-ae4b-eb3276b8571c" },
	// User profile
	{ name: "Profile", path: "/profile/did:plc:jx4g6baqkwdlonylsetvpu7c" },
	// Deck page - disable target-size (deck stats are intentionally compact)
	{
		name: "Deck: Hamza",
		path: "/profile/did:plc:jx4g6baqkwdlonylsetvpu7c/deck/3m7lphyavvp2u",
		disableRules: ["target-size"],
	},
];

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
	if (violations.length === 0) return "";

	const lines: string[] = [];
	for (const v of violations) {
		lines.push(`\n  [${v.impact?.toUpperCase()}] ${v.id}`);
		lines.push(`    ${v.help}`);
		lines.push(`    ${v.helpUrl}`);
		for (const node of v.nodes.slice(0, 5)) {
			lines.push(`    → ${node.target.join(" > ")}`);
			if (node.failureSummary) {
				// Indent the summary
				const summary = node.failureSummary.split("\n").map(l => `      ${l}`).join("\n");
				lines.push(summary);
			}
		}
		if (v.nodes.length > 5) {
			lines.push(`    ... and ${v.nodes.length - 5} more`);
		}
	}
	return lines.join("\n");
}

for (const { name, path, disableRules } of testPages) {
	test.describe(`${name}`, () => {
		test("light mode accessibility", async ({ page }) => {
			await page.goto(path);
			await page.waitForLoadState("networkidle");

			let builder = new AxeBuilder({ page }).withTags([
				"wcag2a",
				"wcag2aa",
				"wcag21a",
				"wcag21aa",
				"wcag22aa",
				"best-practice",
			]);
			if (disableRules) {
				builder = builder.disableRules(disableRules);
			}
			const results = await builder.analyze();

			if (results.violations.length > 0) {
				throw new Error(
					`${results.violations.length} accessibility violations:\n${formatViolations(results.violations)}`,
				);
			}
		});

		test("dark mode accessibility", async ({ page }) => {
			await page.goto(path);
			await page.evaluate(() => {
				document.documentElement.classList.add("dark");
				localStorage.setItem("theme", "dark");
			});
			await page.waitForTimeout(100);
			await page.waitForLoadState("networkidle");

			let builder = new AxeBuilder({ page }).withTags([
				"wcag2a",
				"wcag2aa",
				"wcag21a",
				"wcag21aa",
				"wcag22aa",
				"best-practice",
			]);
			if (disableRules) {
				builder = builder.disableRules(disableRules);
			}
			const results = await builder.analyze();

			if (results.violations.length > 0) {
				throw new Error(
					`${results.violations.length} accessibility violations:\n${formatViolations(results.violations)}`,
				);
			}
		});
	});
}

// Informational AAA check - logs but doesn't fail
test("AAA contrast audit (informational)", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => {
		document.documentElement.classList.add("dark");
	});
	await page.waitForTimeout(100);

	const results = await new AxeBuilder({ page })
		.withRules(["color-contrast-enhanced"])
		.analyze();

	if (results.violations.length > 0) {
		console.log(`\n━━━ AAA Contrast Issues (informational) ━━━${formatViolations(results.violations)}\n`);
	}
	// Don't fail - just informational
});
