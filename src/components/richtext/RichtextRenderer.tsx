import { sanitizeUrl } from "@braintree/sanitize-url";
import { Link } from "@tanstack/react-router";
import { memo, type ReactNode } from "react";
import type {
	BulletListBlock,
	CodeBlock,
	Document,
	HeadingBlock,
	HorizontalRuleBlock,
	ListItem,
	OrderedListBlock,
	ParagraphBlock,
} from "@/lib/lexicons/types/com/deckbelcher/richtext";
import type { Main as Facet } from "@/lib/lexicons/types/com/deckbelcher/richtext/facet";
import { segmentize } from "@/lib/richtext-convert";

type Block =
	| ParagraphBlock
	| HeadingBlock
	| CodeBlock
	| BulletListBlock
	| OrderedListBlock
	| HorizontalRuleBlock;

export interface RichtextRendererProps {
	doc: Document | undefined;
	className?: string;
}

export const RichtextRenderer = memo(function RichtextRenderer({
	doc,
	className,
}: RichtextRendererProps) {
	if (!doc?.content) {
		return null;
	}

	return (
		<div className={className}>
			{doc.content.map((block, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: doc is immutable during render
				<BlockRenderer key={i} block={block} />
			))}
		</div>
	);
});

const BlockRenderer = memo(function BlockRenderer({
	block,
}: {
	block: Block;
}): ReactNode {
	switch (block.$type) {
		case "com.deckbelcher.richtext#headingBlock": {
			const level = block.level ?? 1;
			const content = (
				<TextWithFacets text={block.text} facets={block.facets} />
			);
			switch (level) {
				case 1:
					return <h1 className="text-2xl font-bold mt-4 mb-2">{content}</h1>;
				case 2:
					return <h2 className="text-xl font-bold mt-3 mb-2">{content}</h2>;
				case 3:
					return <h3 className="text-lg font-semibold mt-3 mb-1">{content}</h3>;
				case 4:
					return (
						<h4 className="text-base font-semibold mt-2 mb-1">{content}</h4>
					);
				case 5:
					return <h5 className="text-sm font-semibold mt-2 mb-1">{content}</h5>;
				case 6:
					return <h6 className="text-sm font-medium mt-2 mb-1">{content}</h6>;
				default:
					return <h1 className="text-2xl font-bold mt-4 mb-2">{content}</h1>;
			}
		}

		case "com.deckbelcher.richtext#codeBlock":
			return (
				<pre className="bg-gray-100 dark:bg-slate-800 rounded-lg p-3 my-2 overflow-x-auto">
					<code className="font-mono text-sm text-gray-800 dark:text-gray-200">
						{block.text}
					</code>
				</pre>
			);

		case "com.deckbelcher.richtext#bulletListBlock":
			return (
				<ul className="list-disc pl-6 my-2 space-y-1 [&_ul]:list-[circle] [&_ul_ul]:list-[square]">
					{block.items.map((item, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: doc is immutable
						<ListItemRenderer key={i} item={item} />
					))}
				</ul>
			);

		case "com.deckbelcher.richtext#orderedListBlock":
			return (
				<ol
					className="list-decimal pl-6 my-2 space-y-1 [&_ol]:list-[lower-alpha] [&_ol_ol]:list-[lower-roman]"
					start={block.start ?? 1}
				>
					{block.items.map((item, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: doc is immutable
						<ListItemRenderer key={i} item={item} />
					))}
				</ol>
			);

		case "com.deckbelcher.richtext#horizontalRuleBlock":
			return <hr className="my-4 border-gray-300 dark:border-slate-600" />;

		default: {
			const para = block as ParagraphBlock;
			const isEmpty = !para.text?.trim();
			return (
				<p>
					{isEmpty ? (
						<br />
					) : (
						<TextWithFacets text={para.text} facets={para.facets} />
					)}
				</p>
			);
		}
	}
});

const ListItemRenderer = memo(function ListItemRenderer({
	item,
}: {
	item: ListItem;
}): ReactNode {
	const isEmpty = !item.text?.trim();
	const sublistType = (item.sublist as { $type?: string } | undefined)?.$type;

	return (
		<li>
			{isEmpty ? (
				<br />
			) : (
				<TextWithFacets text={item.text} facets={item.facets} />
			)}
			{sublistType === "com.deckbelcher.richtext#bulletListBlock" && (
				<ul className="list-disc pl-6 mt-1 space-y-1">
					{(item.sublist as BulletListBlock).items.map((subItem, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: doc is immutable
						<ListItemRenderer key={i} item={subItem} />
					))}
				</ul>
			)}
			{sublistType === "com.deckbelcher.richtext#orderedListBlock" && (
				<ol
					className="list-decimal pl-6 mt-1 space-y-1"
					start={(item.sublist as OrderedListBlock).start ?? 1}
				>
					{(item.sublist as OrderedListBlock).items.map((subItem, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: doc is immutable
						<ListItemRenderer key={i} item={subItem} />
					))}
				</ol>
			)}
		</li>
	);
});

function TextWithFacets({
	text,
	facets,
}: {
	text?: string;
	facets?: Facet[];
}): ReactNode {
	if (!text) {
		return null;
	}

	if (!facets || facets.length === 0) {
		return text;
	}

	const segments = segmentize(text, facets);

	return (
		<>
			{segments.map((segment, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: segments are immutable
				<SegmentRenderer key={i} segment={segment} />
			))}
		</>
	);
}

function SegmentRenderer({
	segment,
}: {
	segment: { text: string; features: unknown[] };
}): ReactNode {
	let content: ReactNode = segment.text;

	for (const feature of segment.features) {
		content = applyFeature(content, feature as Facet["features"][number]);
	}

	return content;
}

function applyFeature(
	content: ReactNode,
	feature: Facet["features"][number],
): ReactNode {
	switch (feature.$type) {
		case "com.deckbelcher.richtext.facet#bold":
			return <strong>{content}</strong>;

		case "com.deckbelcher.richtext.facet#italic":
			return <em>{content}</em>;

		case "com.deckbelcher.richtext.facet#code":
			return (
				<code className="bg-gray-100 dark:bg-slate-800 px-1 rounded font-mono text-sm">
					{content}
				</code>
			);

		case "com.deckbelcher.richtext.facet#link": {
			const safeUrl = sanitizeUrl(feature.uri);
			if (safeUrl === "about:blank") {
				return content;
			}
			return (
				<a
					href={safeUrl}
					className="text-blue-600 dark:text-blue-400 hover:underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					{content}
				</a>
			);
		}

		case "com.deckbelcher.richtext.facet#mention":
			return (
				<Link
					to="/profile/$did"
					params={{ did: feature.did }}
					className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/70"
				>
					{content}
				</Link>
			);

		default:
			return content;
	}
}
