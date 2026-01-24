import { describe, expect, it } from "vitest";
import { stripDiacritics } from "../normalize-text";

describe("stripDiacritics", () => {
	it("strips umlauts", () => {
		expect(stripDiacritics("Jötun")).toBe("Jotun");
		expect(stripDiacritics("ö")).toBe("o");
		expect(stripDiacritics("ü")).toBe("u");
		expect(stripDiacritics("ä")).toBe("a");
	});

	it("strips circumflexes", () => {
		expect(stripDiacritics("Lim-Dûl")).toBe("Lim-Dul");
		expect(stripDiacritics("û")).toBe("u");
		expect(stripDiacritics("ê")).toBe("e");
		expect(stripDiacritics("â")).toBe("a");
	});

	it("strips other Latin diacritics", () => {
		expect(stripDiacritics("Dandân")).toBe("Dandan");
		expect(stripDiacritics("café")).toBe("cafe");
		expect(stripDiacritics("naïve")).toBe("naive");
		expect(stripDiacritics("señor")).toBe("senor");
	});

	it("preserves non-diacritic characters", () => {
		expect(stripDiacritics("Lightning Bolt")).toBe("Lightning Bolt");
		expect(stripDiacritics("Fire & Ice")).toBe("Fire & Ice");
		expect(stripDiacritics("123")).toBe("123");
	});

	it("does not affect CJK characters", () => {
		expect(stripDiacritics("稲妻")).toBe("稲妻");
		expect(stripDiacritics("日本語")).toBe("日本語");
	});

	it("does not affect Cyrillic", () => {
		expect(stripDiacritics("Москва")).toBe("Москва");
	});

	it("does not affect Arabic", () => {
		expect(stripDiacritics("العربية")).toBe("العربية");
	});

	it("handles empty string", () => {
		expect(stripDiacritics("")).toBe("");
	});

	it("handles mixed content", () => {
		expect(stripDiacritics("Jötun's Wrath")).toBe("Jotun's Wrath");
	});
});
