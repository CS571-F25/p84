import { schema as markdownSchema } from "prosemirror-markdown";
import { Schema } from "prosemirror-model";

/**
 * Extended schema adding custom inline nodes for deck primers.
 *
 * Extends prosemirror-markdown's schema with:
 * - mention: @username references
 * - (future) cardRef: [[Card Name]] references
 */
export const schema = new Schema({
	nodes: markdownSchema.spec.nodes.addBefore("image", "mention", {
		inline: true,
		group: "inline",
		atom: true, // Treated as a single unit, not editable internally
		attrs: {
			handle: { default: "" },
		},
		toDOM(node) {
			return [
				"span",
				{
					class:
						"inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium",
					"data-handle": node.attrs.handle,
				},
				`@${node.attrs.handle}`,
			];
		},
		parseDOM: [
			{
				tag: "span.mention",
				getAttrs(dom) {
					if (typeof dom === "string") return false;
					return { handle: dom.getAttribute("data-handle") ?? "" };
				},
			},
		],
	}),
	marks: markdownSchema.spec.marks,
});
