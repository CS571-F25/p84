import { ByteString } from "./byte-string";
import {
	type Facet,
	isBold,
	isCode,
	isCodeBlock,
	isItalic,
	isLink,
	isMention,
} from "./types";

type BoundaryType = "bold" | "italic" | "code";

interface Boundary {
	bytePos: number;
	type: BoundaryType;
	isOpen: boolean;
}

interface Replacement {
	byteStart: number;
	byteEnd: number;
	output: string;
}

export function serializeToMarkdown(text: string, facets: Facet[]): string {
	if (facets.length === 0) {
		return text;
	}

	const bs = new ByteString(text);
	const boundaries: Boundary[] = [];
	const replacements: Replacement[] = [];

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
				boundaries.push({ bytePos: byteStart, type: "bold", isOpen: true });
				boundaries.push({ bytePos: byteEnd, type: "bold", isOpen: false });
			} else if (isItalic(feature)) {
				boundaries.push({ bytePos: byteStart, type: "italic", isOpen: true });
				boundaries.push({ bytePos: byteEnd, type: "italic", isOpen: false });
			} else if (isCode(feature)) {
				boundaries.push({ bytePos: byteStart, type: "code", isOpen: true });
				boundaries.push({ bytePos: byteEnd, type: "code", isOpen: false });
			} else if (isCodeBlock(feature)) {
				const content = bs.sliceByBytes(byteStart, byteEnd);
				replacements.push({
					byteStart,
					byteEnd,
					output: `\`\`\`\n${content}\n\`\`\``,
				});
			} else if (isLink(feature)) {
				const linkText = bs.sliceByBytes(byteStart, byteEnd);
				replacements.push({
					byteStart,
					byteEnd,
					output: `[${linkText}](${feature.uri})`,
				});
			} else if (isMention(feature)) {
				// Mentions keep @handle in text, so just output as-is
				// (the text already includes @handle)
			}
		}
	}

	// If we have replacements, handle them separately
	// (they replace entire ranges rather than wrapping)
	if (replacements.length > 0) {
		return serializeWithReplacements(bs, boundaries, replacements);
	}

	// Sort boundaries by position, closes before opens at same position
	boundaries.sort((a, b) => {
		if (a.bytePos !== b.bytePos) {
			return a.bytePos - b.bytePos;
		}
		if (a.isOpen !== b.isOpen) {
			return a.isOpen ? 1 : -1;
		}
		return 0;
	});

	const parts: string[] = [];
	let lastPos = 0;

	for (const boundary of boundaries) {
		if (boundary.bytePos > lastPos) {
			parts.push(bs.sliceByBytes(lastPos, boundary.bytePos));
		}

		const marker = getMarker(boundary.type);
		parts.push(marker);

		lastPos = boundary.bytePos;
	}

	if (lastPos < bs.length) {
		parts.push(bs.sliceByBytes(lastPos, bs.length));
	}

	return parts.join("");
}

function getMarker(type: BoundaryType): string {
	switch (type) {
		case "bold":
			return "**";
		case "italic":
			return "*";
		case "code":
			return "`";
	}
}

function serializeWithReplacements(
	bs: ByteString,
	boundaries: Boundary[],
	replacements: Replacement[],
): string {
	// Combine boundaries and replacements into a unified event stream
	type Event =
		| { type: "boundary"; pos: number; boundary: Boundary }
		| { type: "replacement"; pos: number; replacement: Replacement };

	const events: Event[] = [];

	for (const b of boundaries) {
		events.push({ type: "boundary", pos: b.bytePos, boundary: b });
	}

	for (const r of replacements) {
		events.push({ type: "replacement", pos: r.byteStart, replacement: r });
	}

	// Sort events by position
	events.sort((a, b) => {
		if (a.pos !== b.pos) return a.pos - b.pos;
		// Replacements come after boundaries at same position
		if (a.type !== b.type) return a.type === "boundary" ? -1 : 1;
		if (a.type === "boundary" && b.type === "boundary") {
			return a.boundary.isOpen ? 1 : -1;
		}
		return 0;
	});

	const parts: string[] = [];
	let lastPos = 0;

	for (const event of events) {
		if (event.type === "boundary") {
			if (event.pos > lastPos) {
				parts.push(bs.sliceByBytes(lastPos, event.pos));
				lastPos = event.pos;
			}
			parts.push(getMarker(event.boundary.type));
		} else {
			// Replacement
			const r = event.replacement;
			if (r.byteStart > lastPos) {
				parts.push(bs.sliceByBytes(lastPos, r.byteStart));
			}
			parts.push(r.output);
			lastPos = r.byteEnd;
		}
	}

	if (lastPos < bs.length) {
		parts.push(bs.sliceByBytes(lastPos, bs.length));
	}

	return parts.join("");
}
