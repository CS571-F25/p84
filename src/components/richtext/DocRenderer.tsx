import type { ReactNode } from "react";

/**
 * ProseMirror document JSON structure types
 */
interface PMNode {
	type: string;
	content?: PMNode[];
	text?: string;
	marks?: PMMark[];
	attrs?: Record<string, unknown>;
}

interface PMMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface DocRendererProps {
	doc: PMNode;
	className?: string;
}

/**
 * Renders a ProseMirror document JSON structure to React elements.
 * Used for read-only display of rich text content.
 */
export function DocRenderer({ doc, className }: DocRendererProps) {
	if (!doc || doc.type !== "doc") {
		return null;
	}

	return (
		<div className={className}>
			{doc.content?.map((node, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: immutable doc structure
				<BlockNode key={i} node={node} />
			))}
		</div>
	);
}

function BlockNode({ node }: { node: PMNode }): ReactNode {
	switch (node.type) {
		case "paragraph":
			return (
				<p>
					{node.content?.map((child, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: immutable doc structure
						<InlineNode key={i} node={child} />
					))}
				</p>
			);

		case "heading": {
			const level = (node.attrs?.level as number) ?? 1;
			const clampedLevel = Math.min(Math.max(level, 1), 6);
			const content = node.content?.map((child, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: immutable doc structure
				<InlineNode key={i} node={child} />
			));
			switch (clampedLevel) {
				case 1:
					return <h1>{content}</h1>;
				case 2:
					return <h2>{content}</h2>;
				case 3:
					return <h3>{content}</h3>;
				case 4:
					return <h4>{content}</h4>;
				case 5:
					return <h5>{content}</h5>;
				case 6:
					return <h6>{content}</h6>;
				default:
					return <h1>{content}</h1>;
			}
		}

		case "code_block":
			return (
				<pre className="bg-gray-100 dark:bg-slate-800 p-3 rounded-lg overflow-x-auto">
					<code>{node.content?.map((child) => child.text).join("") ?? ""}</code>
				</pre>
			);

		case "blockquote":
			return (
				<blockquote className="border-l-4 border-gray-300 dark:border-slate-600 pl-4 italic">
					{node.content?.map((child, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: immutable doc structure
						<BlockNode key={i} node={child} />
					))}
				</blockquote>
			);

		case "horizontal_rule":
			return <hr className="border-gray-300 dark:border-slate-600 my-4" />;

		case "hard_break":
			return <br />;

		default:
			// Unknown block type - skip gracefully
			return null;
	}
}

function InlineNode({ node }: { node: PMNode }): ReactNode {
	if (node.type === "text") {
		let content: ReactNode = node.text ?? "";

		// Apply marks in order
		for (const mark of node.marks ?? []) {
			content = applyMark(content, mark);
		}

		return content;
	}

	if (node.type === "hard_break") {
		return <br />;
	}

	if (node.type === "mention") {
		const handle = node.attrs?.handle as string;
		return (
			<span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium">
				@{handle}
			</span>
		);
	}

	// Future: handle cardRef, etc.
	// if (node.type === "cardRef") {
	//   return <CardRefChip oracleId={node.attrs.oracleId} name={node.attrs.displayName} />;
	// }

	// Unknown inline type - skip gracefully
	return null;
}

function applyMark(content: ReactNode, mark: PMMark): ReactNode {
	switch (mark.type) {
		case "strong":
			return <strong>{content}</strong>;

		case "em":
			return <em>{content}</em>;

		case "code":
			return (
				<code className="bg-gray-100 dark:bg-slate-800 px-1 rounded font-mono text-sm">
					{content}
				</code>
			);

		case "link": {
			const href = mark.attrs?.href as string;
			return (
				<a
					href={href}
					className="text-blue-600 dark:text-blue-400 hover:underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					{content}
				</a>
			);
		}

		default:
			// Unknown mark - return content unchanged
			return content;
	}
}
