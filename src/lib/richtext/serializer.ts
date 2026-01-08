import { ByteString } from "./byte-string";
import { type Facet, isBold, isItalic } from "./types";

interface Boundary {
	bytePos: number;
	type: "bold" | "italic";
	isOpen: boolean;
}

export function serializeToMarkdown(text: string, facets: Facet[]): string {
	if (facets.length === 0) {
		return text;
	}

	const bs = new ByteString(text);

	// Collect all boundaries (open and close positions for each facet)
	// Skip invalid facets (out of bounds, empty, or malformed)
	const boundaries: Boundary[] = [];

	for (const facet of facets) {
		const { byteStart, byteEnd } = facet.index;

		// Validate facet bounds
		if (
			byteStart < 0 ||
			byteEnd < 0 ||
			byteStart >= byteEnd ||
			byteEnd > bs.length
		) {
			continue;
		}

		for (const feature of facet.features) {
			if (isBold(feature)) {
				boundaries.push({
					bytePos: byteStart,
					type: "bold",
					isOpen: true,
				});
				boundaries.push({
					bytePos: byteEnd,
					type: "bold",
					isOpen: false,
				});
			} else if (isItalic(feature)) {
				boundaries.push({
					bytePos: byteStart,
					type: "italic",
					isOpen: true,
				});
				boundaries.push({
					bytePos: byteEnd,
					type: "italic",
					isOpen: false,
				});
			}
		}
	}

	// Sort boundaries by position, with closes before opens at the same position
	// This ensures proper nesting: close inner before opening next
	boundaries.sort((a, b) => {
		if (a.bytePos !== b.bytePos) {
			return a.bytePos - b.bytePos;
		}
		// At same position: closes come before opens
		if (a.isOpen !== b.isOpen) {
			return a.isOpen ? 1 : -1;
		}
		return 0;
	});

	// Build output by inserting markers at boundaries
	const parts: string[] = [];
	let lastPos = 0;

	for (const boundary of boundaries) {
		// Add text before this boundary
		if (boundary.bytePos > lastPos) {
			parts.push(bs.sliceByBytes(lastPos, boundary.bytePos));
		}

		// Add the marker
		const marker = boundary.type === "bold" ? "**" : "*";
		parts.push(marker);

		lastPos = boundary.bytePos;
	}

	// Add remaining text
	if (lastPos < bs.length) {
		parts.push(bs.sliceByBytes(lastPos, bs.length));
	}

	return parts.join("");
}
