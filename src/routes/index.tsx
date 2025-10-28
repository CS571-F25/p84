import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center px-6">
			<div className="text-center max-w-2xl">
				<h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
					DeckBelcher
				</h1>
				<p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
					MTG deck building and sharing powered by AT Protocol
				</p>
				<Link
					to="/cards"
					className="inline-block px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors"
				>
					Browse Cards
				</Link>
			</div>
		</div>
	);
}
