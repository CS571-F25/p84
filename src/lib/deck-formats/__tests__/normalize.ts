/**
 * Normalizers for roundtrip testing
 *
 * These functions transform deck text to account for intentional data loss
 * during parsing/exporting. They're used to make roundtrip comparisons fair
 * by normalizing both original and exported text.
 */

/**
 * Strip *F* (foil) and *A* (alter) markers from Moxfield format.
 * We don't track foil/alter status, so these are intentionally lost.
 */
export function stripFoilAlterMarkers(text: string): string {
	return text
		.replace(/[ \t]*\*[FA]\*[ \t]*/g, " ") // Don't eat newlines
		.split("\n")
		.map((line) => line.trim())
		.join("\n");
}

/**
 * Collapse #!tag (global) to #tag (local) and deduplicate.
 * We don't distinguish between global and local tags.
 * If original has both #!foo and #foo, collapse produces duplicates - dedupe them.
 */
export function collapseGlobalTags(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			// Find all tags in the line
			const tagMatches = line.match(/#!?[\w\s/-]+(?=\s*#|$)/g);
			if (!tagMatches) return line.replace(/#!/g, "#");

			// Collapse and deduplicate
			const seenTags = new Set<string>();
			let result = line;
			for (const tag of tagMatches) {
				const normalized = tag.replace(/^#!/, "#");
				if (seenTags.has(normalized)) {
					// Remove this duplicate occurrence
					result = result.replace(tag, "").replace(/ {2,}/g, " ");
				} else {
					seenTags.add(normalized);
					result = result.replace(tag, normalized);
				}
			}
			return result.trim();
		})
		.join("\n");
}

/**
 * Strip <variant> markers from MTGGoldfish format.
 * We extract collector numbers from <123> but lose other variant info.
 */
export function stripVariantMarkers(text: string): string {
	// Keep collector numbers in angle brackets, strip other variants
	return text.replace(/<(?!\d+[a-z★†]?>)[^>]+>/gi, "").replace(/ {2,}/g, " ");
}

/**
 * Strip XMage LAYOUT metadata lines.
 * We don't preserve layout information.
 */
export function stripLayoutLines(text: string): string {
	return text
		.split("\n")
		.filter((line) => !line.trim().startsWith("LAYOUT "))
		.join("\n");
}

/**
 * Strip Archidekt ^Tag,#color^ ownership markers.
 * We don't track ownership/inventory status.
 */
export function stripOwnershipMarkers(text: string): string {
	return text
		.replace(/[ \t]*\^[^^]+\^[ \t]*/g, " ") // Don't eat newlines
		.split("\n")
		.map((line) => line.trim())
		.join("\n");
}

/**
 * Normalize Archidekt {options} in brackets.
 * We don't preserve {top}, {noDeck}, {noPrice} options.
 */
export function normalizeArchidektOptions(text: string): string {
	return text
		.replace(/\{top\}/g, "")
		.replace(/\{noDeck\}/g, "")
		.replace(/\{noPrice\}/g, "");
}

/**
 * Strip category header lines (single words that aren't section names).
 * Archidekt "by category" format uses these for organization.
 */
export function stripCategoryHeaders(text: string): string {
	const sectionNames = new Set([
		"commander",
		"mainboard",
		"sideboard",
		"maybeboard",
		"deck",
		"main",
	]);

	return text
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim().toLowerCase();
			// Keep section names, remove other single-word headers
			if (sectionNames.has(trimmed)) return true;
			// Remove lines that are just a single word (category header)
			if (/^[A-Za-z]+$/.test(line.trim())) return false;
			return true;
		})
		.join("\n");
}

/**
 * Strip Deckstats custom category comments.
 * We only preserve //Main, //Sideboard, //Maybeboard, //Commander.
 */
export function stripCustomCategoryComments(text: string): string {
	const preservedSections = new Set([
		"main",
		"mainboard",
		"sideboard",
		"side",
		"maybeboard",
		"maybe",
		"commander",
	]);

	return text
		.split("\n")
		.filter((line) => {
			if (!line.trim().startsWith("//")) return true;
			const sectionName = line.trim().slice(2).trim().toLowerCase();
			// Preserve NAME: metadata
			if (sectionName.startsWith("name:")) return true;
			// Preserve known section markers
			return preservedSections.has(sectionName);
		})
		.join("\n");
}

/**
 * Apply all normalizations for a given format.
 */
export function normalizeForRoundtrip(text: string, format: string): string {
	let result = text;

	// Universal normalizations
	result = stripFoilAlterMarkers(result);
	result = collapseGlobalTags(result);
	result = stripOwnershipMarkers(result);

	// Format-specific normalizations
	switch (format) {
		case "xmage":
			result = stripLayoutLines(result);
			break;
		case "mtggoldfish":
			result = stripVariantMarkers(result);
			break;
		case "archidekt":
			result = normalizeArchidektOptions(result);
			result = stripCategoryHeaders(result);
			break;
		case "deckstats":
			result = stripCustomCategoryComments(result);
			break;
	}

	// Clean up whitespace
	result = result.replace(/\r\n/g, "\n");
	result = result.replace(/\n{3,}/g, "\n\n");
	result = result
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
	result = result.trim();

	return result;
}
