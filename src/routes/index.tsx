import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, User } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/")({ component: App });

function App() {
	const { session } = useAuth();

	return (
		<div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
			<div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
				<div className="text-center mb-16">
					<h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
						DeckBelcher
					</h1>
					<p className="text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
						MTG deck building and sharing powered by AT Protocol
					</p>
				</div>

				<div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
					{session ? (
						<Link
							to="/deck/new"
							className="group flex flex-col items-center p-6 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-lg transition-all"
						>
							<div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mb-4 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-800/40 transition-colors">
								<Plus size={24} className="text-cyan-600 dark:text-cyan-400" />
							</div>
							<span className="font-semibold text-gray-900 dark:text-white">
								Create Deck
							</span>
							<span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Start building
							</span>
						</Link>
					) : (
						<Link
							to="/signin"
							className="group flex flex-col items-center p-6 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-lg transition-all"
						>
							<div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mb-4 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-800/40 transition-colors">
								<User size={24} className="text-cyan-600 dark:text-cyan-400" />
							</div>
							<span className="font-semibold text-gray-900 dark:text-white">
								Sign In
							</span>
							<span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Get started
							</span>
						</Link>
					)}

					{session ? (
						<Link
							to="/profile/$did"
							params={{ did: session.info.sub }}
							className="group flex flex-col items-center p-6 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-lg transition-all"
						>
							<div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 group-hover:bg-gray-200 dark:group-hover:bg-slate-600 transition-colors">
								<User size={24} className="text-gray-600 dark:text-gray-300" />
							</div>
							<span className="font-semibold text-gray-900 dark:text-white">
								My Decks
							</span>
							<span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
								View your collection
							</span>
						</Link>
					) : (
						<div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50 rounded-xl opacity-50 cursor-not-allowed">
							<div className="w-12 h-12 bg-gray-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
								<User size={24} className="text-gray-400 dark:text-gray-500" />
							</div>
							<span className="font-semibold text-gray-400 dark:text-gray-500">
								My Decks
							</span>
							<span className="text-sm text-gray-400 dark:text-gray-500 mt-1">
								Sign in to view
							</span>
						</div>
					)}

					<Link
						to="/cards"
						search={{ q: "", sort: undefined }}
						className="group flex flex-col items-center p-6 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-lg transition-all"
					>
						<div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 group-hover:bg-gray-200 dark:group-hover:bg-slate-600 transition-colors">
							<Search size={24} className="text-gray-600 dark:text-gray-300" />
						</div>
						<span className="font-semibold text-gray-900 dark:text-white">
							Browse Cards
						</span>
						<span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Search the database
						</span>
					</Link>
				</div>

				<div className="mt-16 text-center">
					<p className="text-sm text-gray-500 dark:text-gray-500">
						Built on the{" "}
						<a
							href="https://atproto.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-cyan-600 dark:text-cyan-400 hover:underline"
						>
							AT Protocol
						</a>{" "}
						— your decks, your data
					</p>
				</div>
			</div>
		</div>
	);
}
