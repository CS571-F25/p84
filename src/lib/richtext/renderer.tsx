import { memo, type ReactNode } from "react";
import { ByteString } from "./byte-string";
import {
	type Facet,
	type FormatFeature,
	isBold,
	isCode,
	isCodeBlock,
	isItalic,
	isLink,
	isMention,
	type LinkFeature,
	type MentionFeature,
} from "./types";

interface RichTextProps {
	text: string;
	facets?: Facet[];
	className?: string;
}

interface Segment {
	text: string;
	bold: boolean;
	italic: boolean;
	code: boolean;
	codeBlock: boolean;
	link: LinkFeature | null;
	mention: MentionFeature | null;
}

export const RichText = memo(function RichText({
	text,
	facets,
	className,
}: RichTextProps): ReactNode {
	if (!text) {
		return null;
	}

	const segments = segmentText(text, facets ?? []);

	return (
		<span className={className}>
			{segments.map((segment, i) => renderSegment(segment, i))}
		</span>
	);
});

function renderSegment(segment: Segment, key: number): ReactNode {
	if (segment.codeBlock) {
		return (
			<pre
				key={key}
				className="bg-gray-100 dark:bg-slate-800 p-2 rounded my-2 overflow-x-auto"
			>
				<code>{segment.text}</code>
			</pre>
		);
	}

	// Plain text - no wrapper needed
	if (
		!segment.bold &&
		!segment.italic &&
		!segment.code &&
		!segment.link &&
		!segment.mention
	) {
		return segment.text;
	}

	let content: ReactNode = segment.text;

	// Wrap in formatting elements (innermost to outermost)
	if (segment.code) {
		content = (
			<code className="bg-gray-100 dark:bg-slate-800 px-1 rounded font-mono text-sm">
				{content}
			</code>
		);
	}
	if (segment.italic) {
		content = <em>{content}</em>;
	}
	if (segment.bold) {
		content = <strong>{content}</strong>;
	}

	// Links and mentions wrap the formatted content
	if (segment.link) {
		return (
			<a
				key={key}
				href={segment.link.uri}
				className="text-blue-600 dark:text-blue-400 hover:underline"
				target="_blank"
				rel="noopener noreferrer"
			>
				{content}
			</a>
		);
	}

	if (segment.mention) {
		return (
			<span
				key={key}
				className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
				data-did={segment.mention.did}
			>
				{content}
			</span>
		);
	}

	// Non-link/mention formatted content needs a keyed wrapper
	return <span key={key}>{content}</span>;
}

function collectFeatures(
	start: number,
	end: number,
	facets: Facet[],
): FormatFeature[] {
	return facets.flatMap((facet) => {
		const { byteStart, byteEnd } = facet.index;
		if (start >= byteStart && end <= byteEnd) {
			return facet.features;
		}
		return [];
	});
}

function buildSegment(text: string, features: FormatFeature[]): Segment {
	return {
		text,
		bold: features.some(isBold),
		italic: features.some(isItalic),
		code: features.some(isCode),
		codeBlock: features.some(isCodeBlock),
		link: features.find(isLink) ?? null,
		mention: features.find(isMention) ?? null,
	};
}

function segmentText(text: string, facets: Facet[]): Segment[] {
	if (facets.length === 0) {
		return [buildSegment(text, [])];
	}

	const bs = new ByteString(text);

	const validFacets = facets.filter((f) => {
		const { byteStart, byteEnd } = f.index;
		return (
			byteStart >= 0 &&
			byteEnd > byteStart &&
			byteEnd <= bs.length &&
			f.features.length > 0
		);
	});

	const boundaries = new Set([0, bs.length]);
	for (const facet of validFacets) {
		boundaries.add(facet.index.byteStart);
		boundaries.add(facet.index.byteEnd);
	}

	const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

	return sortedBoundaries
		.slice(0, -1)
		.map((start, i) => {
			const end = sortedBoundaries[i + 1];
			const segText = bs.sliceByBytes(start, end);
			const features = collectFeatures(start, end, validFacets);
			return buildSegment(segText, features);
		})
		.filter((seg) => seg.text.length > 0);
}
