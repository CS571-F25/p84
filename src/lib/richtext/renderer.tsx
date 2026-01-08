import type { ReactNode } from "react";
import { ByteString } from "./byte-string";
import { type Facet, isBold, isItalic } from "./types";

interface RichTextProps {
	text: string;
	facets?: Facet[];
	className?: string;
}

interface Segment {
	text: string;
	bold: boolean;
	italic: boolean;
}

export function RichText({
	text,
	facets = [],
	className,
}: RichTextProps): ReactNode {
	if (!text) {
		return null;
	}

	const segments = segmentText(text, facets);

	return (
		<span className={className}>
			{segments.map((segment, i) => renderSegment(segment, i))}
		</span>
	);
}

function renderSegment(segment: Segment, key: number): ReactNode {
	let content: ReactNode = segment.text;

	if (segment.italic) {
		content = <em key={`${key}-i`}>{content}</em>;
	}
	if (segment.bold) {
		content = <strong key={`${key}-b`}>{content}</strong>;
	}

	return content;
}

function segmentText(text: string, facets: Facet[]): Segment[] {
	if (facets.length === 0) {
		return [{ text, bold: false, italic: false }];
	}

	const bs = new ByteString(text);

	// Collect all boundaries (byte positions where formatting changes)
	const boundaries = new Set<number>();
	boundaries.add(0);
	boundaries.add(bs.length);

	// Filter and process valid facets
	const validFacets = facets.filter((f) => {
		const { byteStart, byteEnd } = f.index;
		return (
			byteStart >= 0 &&
			byteEnd > byteStart &&
			byteEnd <= bs.length &&
			f.features.length > 0
		);
	});

	for (const facet of validFacets) {
		boundaries.add(facet.index.byteStart);
		boundaries.add(facet.index.byteEnd);
	}

	const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
	const segments: Segment[] = [];

	for (let i = 0; i < sortedBoundaries.length - 1; i++) {
		const start = sortedBoundaries[i];
		const end = sortedBoundaries[i + 1];

		// Determine which formatting applies to this segment
		let bold = false;
		let italic = false;

		for (const facet of validFacets) {
			const { byteStart, byteEnd } = facet.index;
			if (start >= byteStart && end <= byteEnd) {
				for (const feature of facet.features) {
					if (isBold(feature)) bold = true;
					if (isItalic(feature)) italic = true;
				}
			}
		}

		const segmentText = bs.sliceByBytes(start, end);
		if (segmentText) {
			segments.push({ text: segmentText, bold, italic });
		}
	}

	return segments;
}
