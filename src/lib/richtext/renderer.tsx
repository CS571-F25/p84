import type { ReactNode } from "react";
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

type Wrapper = (content: ReactNode, key: string) => ReactNode;

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

	const wrappers: Wrapper[] = [];

	if (segment.code) {
		wrappers.push((c, k) => (
			<code key={k} className="bg-gray-100 dark:bg-slate-800 px-1 rounded">
				{c}
			</code>
		));
	}
	if (segment.italic) {
		wrappers.push((c, k) => <em key={k}>{c}</em>);
	}
	if (segment.bold) {
		wrappers.push((c, k) => <strong key={k}>{c}</strong>);
	}
	if (segment.link) {
		const uri = segment.link.uri;
		wrappers.push((c, k) => (
			<a
				key={k}
				href={uri}
				className="text-blue-600 dark:text-blue-400 hover:underline"
				target="_blank"
				rel="noopener noreferrer"
			>
				{c}
			</a>
		));
	}
	if (segment.mention) {
		const did = segment.mention.did;
		wrappers.push((c, k) => (
			<span
				key={k}
				className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
				data-did={did}
			>
				{c}
			</span>
		));
	}

	return wrappers.reduce<ReactNode>(
		(content, wrap, i) => wrap(content, `${key}-${i}`),
		segment.text,
	);
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
