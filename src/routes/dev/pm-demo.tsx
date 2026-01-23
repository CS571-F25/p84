import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RichtextSection } from "@/components/richtext/RichtextSection";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import { lexiconToTree, treeToLexicon } from "@/lib/richtext-convert";
import type { PMDocJSON } from "@/lib/useProseMirror";

export const Route = createFileRoute("/dev/pm-demo")({
	component: ProseMirrorDemo,
	head: () => ({
		meta: [{ title: "Editor Demo | DeckBelcher" }],
	}),
});

const DEMO_TAGS = [
	"combo",
	"budget",
	"competitive",
	"casual",
	"aggro",
	"control",
];

const SAMPLE_DOC: Document = {
	content: [
		{
			$type: "com.deckbelcher.richtext#paragraphBlock",
			text: "This is a bold and italic text demo.",
			facets: [
				{
					index: { byteStart: 10, byteEnd: 14 },
					features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
				},
				{
					index: { byteStart: 19, byteEnd: 25 },
					features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
				},
			],
		},
		{
			$type: "com.deckbelcher.richtext#paragraphBlock",
			text: "Try typing **bold** or *italic* to use markdown shortcuts!",
			facets: [
				{
					index: { byteStart: 11, byteEnd: 19 },
					features: [{ $type: "com.deckbelcher.richtext.facet#code" }],
				},
				{
					index: { byteStart: 23, byteEnd: 31 },
					features: [{ $type: "com.deckbelcher.richtext.facet#code" }],
				},
			],
		},
	],
};

function ProseMirrorDemo() {
	const [savedDoc, setSavedDoc] = useState<Document | undefined>(SAMPLE_DOC);
	const [lastSaved, setLastSaved] = useState<string>("");

	const handleSave = (doc: Document) => {
		setSavedDoc(doc);
		setLastSaved(new Date().toLocaleTimeString());
		console.log("Saved doc:", JSON.stringify(doc, null, 2));
	};

	// Convert lexicon to PM tree for display
	const pmTreeDoc = useMemo(() => {
		if (!savedDoc) return null;
		try {
			return lexiconToTree(savedDoc).toJSON() as PMDocJSON;
		} catch (e) {
			console.error("Failed to convert to tree:", e);
			return null;
		}
	}, [savedDoc]);

	// Roundtrip: lexicon -> tree -> lexicon
	const roundtrippedDoc = useMemo(() => {
		if (!savedDoc) return null;
		try {
			const pmNode = lexiconToTree(savedDoc);
			return treeToLexicon(pmNode);
		} catch (e) {
			console.error("Failed to roundtrip:", e);
			return null;
		}
	}, [savedDoc]);

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900 p-8">
			<div className="max-w-3xl mx-auto space-y-8">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
						ProseMirror Editor Demo
					</h1>
					<p className="text-gray-600 dark:text-zinc-300">
						Testing the new WYSIWYG editor. Use toolbar buttons or markdown
						shortcuts.
					</p>
				</div>

				<div className="space-y-4">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
						Editor
					</h2>
					<RichtextSection
						document={savedDoc}
						onSave={handleSave}
						readOnly={false}
						availableTags={DEMO_TAGS}
					/>
				</div>

				<div className="space-y-4">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
						Read-only View
					</h2>
					<div className="p-4 border border-gray-200 dark:border-zinc-600 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
						<RichtextSection document={savedDoc} readOnly />
					</div>
				</div>

				{lastSaved && (
					<p className="text-sm text-gray-500 dark:text-zinc-300">
						Last saved: {lastSaved}
					</p>
				)}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<details className="text-sm" open>
						<summary className="cursor-pointer text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-200 font-medium">
							Lexicon (storage format)
						</summary>
						<pre className="mt-2 p-4 bg-gray-100 dark:bg-zinc-800 rounded overflow-auto text-xs max-h-96">
							{JSON.stringify(savedDoc, null, 2)}
						</pre>
					</details>

					<details className="text-sm" open>
						<summary className="cursor-pointer text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-200 font-medium">
							Tree (ProseMirror)
						</summary>
						<pre className="mt-2 p-4 bg-gray-100 dark:bg-zinc-800 rounded overflow-auto text-xs max-h-96">
							{JSON.stringify(pmTreeDoc, null, 2)}
						</pre>
					</details>
				</div>

				<details className="text-sm">
					<summary className="cursor-pointer text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-200 font-medium">
						Roundtrip (lexicon → tree → lexicon)
					</summary>
					<pre className="mt-2 p-4 bg-gray-100 dark:bg-zinc-800 rounded overflow-auto text-xs max-h-96">
						{JSON.stringify(roundtrippedDoc, null, 2)}
					</pre>
					{roundtrippedDoc && savedDoc && (
						<p className="mt-2 text-xs">
							{JSON.stringify(savedDoc) === JSON.stringify(roundtrippedDoc) ? (
								<span className="text-green-600 dark:text-green-400">
									Roundtrip matches original
								</span>
							) : (
								<span className="text-amber-600 dark:text-amber-400">
									Roundtrip differs from original (may be normalized)
								</span>
							)}
						</p>
					)}
				</details>
			</div>
		</div>
	);
}
