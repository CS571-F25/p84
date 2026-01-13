import type { MarkSpec, NodeSpec } from "prosemirror-model";
import { Schema } from "prosemirror-model";

/**
 * Vendored and customized schema based on prosemirror-markdown.
 *
 * Changes from upstream:
 * - Added Tailwind classes for dark mode support
 * - Removed image node (not needed for primers)
 * - Added custom inline nodes: mention, cardRef (future)
 *
 * We vendor this to have full control over styling and custom nodes.
 */

const nodes: Record<string, NodeSpec> = {
	doc: {
		content: "block+",
	},

	paragraph: {
		content: "inline*",
		group: "block",
		parseDOM: [{ tag: "p" }],
		toDOM() {
			return ["p", 0];
		},
	},

	blockquote: {
		content: "block+",
		group: "block",
		parseDOM: [{ tag: "blockquote" }],
		toDOM() {
			return [
				"blockquote",
				{
					class:
						"border-l-4 border-gray-300 dark:border-slate-600 pl-4 my-2 text-gray-600 dark:text-gray-400 italic",
				},
				0,
			];
		},
	},

	horizontal_rule: {
		group: "block",
		parseDOM: [{ tag: "hr" }],
		toDOM() {
			return ["hr", { class: "my-4 border-gray-300 dark:border-slate-600" }];
		},
	},

	heading: {
		attrs: { level: { default: 1 } },
		content: "inline*",
		group: "block",
		defining: true,
		parseDOM: [
			{ tag: "h1", attrs: { level: 1 } },
			{ tag: "h2", attrs: { level: 2 } },
			{ tag: "h3", attrs: { level: 3 } },
			{ tag: "h4", attrs: { level: 4 } },
			{ tag: "h5", attrs: { level: 5 } },
			{ tag: "h6", attrs: { level: 6 } },
		],
		toDOM(node) {
			const level = node.attrs.level as number;
			const classes: Record<number, string> = {
				1: "text-2xl font-bold mt-4 mb-2",
				2: "text-xl font-bold mt-3 mb-2",
				3: "text-lg font-semibold mt-3 mb-1",
				4: "text-base font-semibold mt-2 mb-1",
				5: "text-sm font-semibold mt-2 mb-1",
				6: "text-sm font-medium mt-2 mb-1",
			};
			return [`h${level}`, { class: classes[level] || classes[1] }, 0];
		},
	},

	code_block: {
		content: "text*",
		group: "block",
		code: true,
		defining: true,
		marks: "",
		attrs: { params: { default: "" } },
		parseDOM: [
			{
				tag: "pre",
				preserveWhitespace: "full",
				getAttrs: (node) => ({
					params: (node as HTMLElement).getAttribute("data-params") || "",
				}),
			},
		],
		toDOM(node) {
			return [
				"pre",
				{
					class:
						"bg-gray-100 dark:bg-slate-800 rounded-lg p-3 my-2 overflow-x-auto",
					...(node.attrs.params ? { "data-params": node.attrs.params } : {}),
				},
				[
					"code",
					{ class: "font-mono text-sm text-gray-800 dark:text-gray-200" },
					0,
				],
			];
		},
	},

	ordered_list: {
		content: "list_item+",
		group: "block",
		attrs: { order: { default: 1 }, tight: { default: false } },
		parseDOM: [
			{
				tag: "ol",
				getAttrs(dom) {
					return {
						order: (dom as HTMLElement).hasAttribute("start")
							? Number((dom as HTMLElement).getAttribute("start"))
							: 1,
						tight: (dom as HTMLElement).hasAttribute("data-tight"),
					};
				},
			},
		],
		toDOM(node) {
			return [
				"ol",
				{
					class: "list-decimal pl-6 my-2 space-y-1",
					start: node.attrs.order === 1 ? null : node.attrs.order,
					"data-tight": node.attrs.tight ? "true" : null,
				},
				0,
			];
		},
	},

	bullet_list: {
		content: "list_item+",
		group: "block",
		attrs: { tight: { default: false } },
		parseDOM: [
			{
				tag: "ul",
				getAttrs: (dom) => ({
					tight: (dom as HTMLElement).hasAttribute("data-tight"),
				}),
			},
		],
		toDOM(node) {
			return [
				"ul",
				{
					class: "list-disc pl-6 my-2 space-y-1",
					"data-tight": node.attrs.tight ? "true" : null,
				},
				0,
			];
		},
	},

	list_item: {
		content: "paragraph block*",
		defining: true,
		parseDOM: [{ tag: "li" }],
		toDOM() {
			return ["li", { class: "[&>p]:inline" }, 0];
		},
	},

	text: {
		group: "inline",
	},

	hard_break: {
		inline: true,
		group: "inline",
		selectable: false,
		parseDOM: [{ tag: "br" }],
		toDOM() {
			return ["br"];
		},
	},

	mention: {
		inline: true,
		group: "inline",
		atom: true,
		attrs: {
			handle: { default: "" },
			did: { default: null },
		},
		toDOM(node) {
			return [
				"span",
				{
					class:
						"inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium",
					"data-mention": "",
					"data-handle": node.attrs.handle,
					"data-did": node.attrs.did || "",
				},
				`@${node.attrs.handle}`,
			];
		},
		parseDOM: [
			{
				tag: "span[data-mention]",
				getAttrs(dom) {
					if (typeof dom === "string") return false;
					return {
						handle: dom.getAttribute("data-handle") ?? "",
						did: dom.getAttribute("data-did") || null,
					};
				},
			},
		],
	},
};

const marks: Record<string, MarkSpec> = {
	em: {
		parseDOM: [
			{ tag: "i" },
			{ tag: "em" },
			{ style: "font-style=italic" },
			{ style: "font-style=normal", clearMark: (m) => m.type.name === "em" },
		],
		toDOM() {
			return ["em", { class: "italic" }];
		},
	},

	strong: {
		parseDOM: [
			{ tag: "strong" },
			{
				tag: "b",
				getAttrs: (node) => node.style.fontWeight !== "normal" && null,
			},
			{ style: "font-weight=400", clearMark: (m) => m.type.name === "strong" },
			{
				style: "font-weight",
				getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
			},
		],
		toDOM() {
			return ["strong", { class: "font-bold" }];
		},
	},

	link: {
		attrs: {
			href: {},
			title: { default: null },
		},
		inclusive: false,
		parseDOM: [
			{
				tag: "a[href]",
				getAttrs(dom) {
					if (typeof dom === "string") return false;
					return {
						href: dom.getAttribute("href"),
						title: dom.getAttribute("title"),
					};
				},
			},
		],
		toDOM(node) {
			return [
				"a",
				{
					href: node.attrs.href,
					title: node.attrs.title,
					class: "text-blue-600 dark:text-blue-400 hover:underline",
					target: "_blank",
					rel: "noopener noreferrer",
				},
			];
		},
	},

	code: {
		parseDOM: [{ tag: "code" }],
		toDOM() {
			return [
				"code",
				{
					class:
						"bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 px-1 py-0.5 rounded font-mono text-sm",
				},
			];
		},
	},
};

export const schema = new Schema({ nodes, marks });
