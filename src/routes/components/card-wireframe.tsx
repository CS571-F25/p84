import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CardImage } from "@/components/CardImage";
import { CardWireframe } from "@/components/CardWireframe";
import { syntaxSearchQueryOptions } from "@/lib/queries";
import type { Card } from "@/lib/scryfall-types";

export const Route = createFileRoute("/components/card-wireframe")({
	ssr: false,
	component: CardWireframeDemo,
});

const SAMPLE_QUERIES = [
	{
		label: "Creature",
		query: "layout:normal t:creature o:flying -is:digital",
		limit: 2,
	},
	{
		label: "Instant",
		query: "layout:normal t:instant mv<=2 -is:digital",
		limit: 2,
	},
	{
		label: "Planeswalker",
		query: "layout:normal t:planeswalker -is:digital",
		limit: 2,
	},
	{ label: "Transform", query: "layout:transform -is:digital", limit: 2 },
	{ label: "Modal DFC", query: "layout:modal_dfc -is:digital", limit: 2 },
	{ label: "Split", query: "layout:split -is:digital", limit: 2 },
	{ label: "Flip", query: "layout:flip -is:digital", limit: 2 },
	{ label: "Adventure", query: "layout:adventure -is:digital", limit: 2 },
];

function CardWireframeDemo() {
	const [showImages, setShowImages] = useState(false);

	const queryResults = useQueries({
		queries: SAMPLE_QUERIES.map((sample) =>
			syntaxSearchQueryOptions(sample.query, sample.limit),
		),
	});

	const isLoading = queryResults.some((r) => r.isLoading);

	// Organize cards by layout type
	const cardsByType: { label: string; cards: Card[] }[] = SAMPLE_QUERIES.map(
		(sample, i) => ({
			label: sample.label,
			cards:
				queryResults[i].data?.ok === true ? queryResults[i].data.cards : [],
		}),
	);

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900 py-8 px-4">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<Link
						to="/components"
						className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline mb-2 block"
					>
						← Components
					</Link>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
						CardWireframe
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Text-based card placeholder. Renders card data matching the card's
						layout while images load.
					</p>
				</div>

				{/* Controls */}
				<div className="mb-8 p-4 bg-gray-100 dark:bg-slate-800 rounded-lg flex flex-wrap gap-6">
					<div>
						<span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Compare
						</span>
						<button
							type="button"
							onClick={() => setShowImages(!showImages)}
							className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
								showImages
									? "bg-cyan-500 text-white"
									: "bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
							}`}
						>
							{showImages ? "Showing images" : "Show images"}
						</button>
					</div>
				</div>

				{/* Loading state */}
				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
						<span className="ml-2 text-gray-500 dark:text-gray-400">
							Loading sample cards...
						</span>
					</div>
				)}

				{/* Card grids by type */}
				{!isLoading && (
					<div className="space-y-12">
						{cardsByType.map(
							({ label, cards }) =>
								cards.length > 0 && (
									<section key={label}>
										<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
											{label}
										</h2>
										<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
											{cards.map((card) => (
												<div key={card.id}>
													{showImages ? (
														<CardImage
															card={card}
															size="normal"
															className="w-full"
														/>
													) : (
														<CardWireframe card={card} />
													)}
													<p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
														{card.name}
													</p>
												</div>
											))}
										</div>
									</section>
								),
						)}
					</div>
				)}

				{/* Props documentation */}
				<section className="mt-16 border-t border-gray-200 dark:border-slate-700 pt-8">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
						Props
					</h2>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-200 dark:border-slate-700">
									<th className="text-left py-2 pr-4 font-medium text-gray-900 dark:text-white">
										Prop
									</th>
									<th className="text-left py-2 pr-4 font-medium text-gray-900 dark:text-white">
										Type
									</th>
									<th className="text-left py-2 pr-4 font-medium text-gray-900 dark:text-white">
										Default
									</th>
									<th className="text-left py-2 font-medium text-gray-900 dark:text-white">
										Description
									</th>
								</tr>
							</thead>
							<tbody className="text-gray-600 dark:text-gray-400">
								<tr className="border-b border-gray-100 dark:border-slate-800">
									<td className="py-2 pr-4 font-mono text-xs">card</td>
									<td className="py-2 pr-4 font-mono text-xs">Card</td>
									<td className="py-2 pr-4">required</td>
									<td className="py-2">The card data to display</td>
								</tr>
								<tr>
									<td className="py-2 pr-4 font-mono text-xs">className</td>
									<td className="py-2 pr-4 font-mono text-xs">string</td>
									<td className="py-2">-</td>
									<td className="py-2">Additional CSS classes</td>
								</tr>
							</tbody>
						</table>
					</div>
				</section>

				{/* Usage */}
				<section className="mt-8">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
						Usage
					</h2>
					<pre className="bg-gray-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
						<code className="text-gray-800 dark:text-gray-200">{`import { CardWireframe } from "@/components/CardWireframe";

// Basic usage - renders card as styled text placeholder
<CardWireframe card={card} />

// With custom className
<CardWireframe card={card} className="max-w-xs" />`}</code>
					</pre>
				</section>
			</div>
		</div>
	);
}
