import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PrimerSectionPM } from "@/components/deck/PrimerSectionPM";
import type { PMDocJSON } from "@/lib/useProseMirror";

export const Route = createFileRoute("/pm-demo")({
	component: ProseMirrorDemo,
});

const SAMPLE_DOC: PMDocJSON = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "This is a " },
				{
					type: "text",
					text: "bold",
					marks: [{ type: "strong" }],
				},
				{ type: "text", text: " and " },
				{
					type: "text",
					text: "italic",
					marks: [{ type: "em" }],
				},
				{ type: "text", text: " text demo." },
			],
		},
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Try typing " },
				{
					type: "text",
					text: "**bold**",
					marks: [{ type: "code" }],
				},
				{ type: "text", text: " or " },
				{
					type: "text",
					text: "*italic*",
					marks: [{ type: "code" }],
				},
				{ type: "text", text: " to use markdown shortcuts!" },
			],
		},
	],
};

function ProseMirrorDemo() {
	const [savedDoc, setSavedDoc] = useState<PMDocJSON | undefined>(SAMPLE_DOC);
	const [lastSaved, setLastSaved] = useState<string>("");

	const handleSave = (doc: PMDocJSON) => {
		setSavedDoc(doc);
		setLastSaved(new Date().toLocaleTimeString());
		console.log("Saved doc:", JSON.stringify(doc, null, 2));
	};

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900 p-8">
			<div className="max-w-3xl mx-auto space-y-8">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
						ProseMirror Editor Demo
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Testing the new WYSIWYG editor. Use toolbar buttons or markdown
						shortcuts.
					</p>
				</div>

				<div className="space-y-4">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
						Editor
					</h2>
					<PrimerSectionPM
						initialDoc={savedDoc}
						onSave={handleSave}
						readOnly={false}
					/>
				</div>

				<div className="space-y-4">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
						Read-only View
					</h2>
					<div className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50">
						<PrimerSectionPM initialDoc={savedDoc} readOnly />
					</div>
				</div>

				{lastSaved && (
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Last saved: {lastSaved}
					</p>
				)}

				<details className="text-sm">
					<summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
						View document JSON
					</summary>
					<pre className="mt-2 p-4 bg-gray-100 dark:bg-slate-800 rounded overflow-auto text-xs">
						{JSON.stringify(savedDoc, null, 2)}
					</pre>
				</details>
			</div>
		</div>
	);
}
