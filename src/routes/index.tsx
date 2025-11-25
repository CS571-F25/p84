import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/")({ component: App });

function App() {
	const { session } = useAuth();

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center px-6">
			<div className="text-center max-w-2xl">
				<h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
					DeckBelcher
				</h1>
				<p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
					MTG deck building and sharing powered by AT Protocol
				</p>
				<div className="flex gap-4 justify-center">
					{session ? (
						<>
							<Link
								to="/deck/new"
								className="inline-block px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
							>
								Create Deck
							</Link>
							<Link
								to="/profile/$did"
								params={{ did: session.info.sub }}
								className="inline-block px-8 py-3 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
							>
								My Decks
							</Link>
						</>
					) : (
						<Link
							to="/signin"
							className="inline-block px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
						>
							Sign In
						</Link>
					)}
					<Link
						to="/cards"
						search={{ q: "" }}
						className="inline-block px-8 py-3 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
					>
						Browse Cards
					</Link>
				</div>
			</div>
		</div>
	);
}
