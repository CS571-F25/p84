import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/components/")({
	component: ComponentsIndex,
});

const COMPONENTS = [
	{
		name: "CardWireframe",
		path: "/components/card-wireframe",
		description:
			"Text-based card placeholder. Renders card data matching the card's layout while images load.",
	},
];

function ComponentsIndex() {
	return (
		<div className="min-h-screen bg-white dark:bg-slate-900 py-8 px-4">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
					Components
				</h1>
				<p className="text-gray-600 dark:text-gray-400 mb-8">
					Reusable UI components for DeckBelcher
				</p>

				<div className="grid gap-4">
					{COMPONENTS.map((component) => (
						<Link
							key={component.path}
							to={component.path}
							className="block p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-cyan-500 dark:hover:border-cyan-400 transition-colors"
						>
							<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
								{component.name}
							</h2>
							<p className="text-sm text-gray-600 dark:text-gray-400">
								{component.description}
							</p>
						</Link>
					))}
				</div>
			</div>
		</div>
	);
}
