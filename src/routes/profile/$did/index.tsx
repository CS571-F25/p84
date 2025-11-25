import type { Did } from "@atcute/lexicons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { asRkey } from "@/lib/atproto-client";
import { listUserDecksQueryOptions } from "@/lib/deck-queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/profile/$did/")({
	component: ProfilePage,
	loader: async ({ context, params }) => {
		// Prefetch deck list during SSR
		await context.queryClient.ensureQueryData(
			listUserDecksQueryOptions(params.did as Did),
		);
	},
});

function ProfilePage() {
	const { did } = Route.useParams();
	const { session } = useAuth();
	const { data } = useSuspenseQuery(listUserDecksQueryOptions(did as Did));

	const isOwner = session?.info.sub === did;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-16">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
						Decklists
					</h1>
					<p className="text-gray-600 dark:text-gray-400">{did}</p>
				</div>

				{data.records.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-gray-600 dark:text-gray-400 mb-4">
							{isOwner ? "No decklists yet" : "No decklists"}
						</p>
						{isOwner && (
							<Link
								to="/deck/new"
								className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
							>
								Create Your First Deck
							</Link>
						)}
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{data.records.map((record) => {
							const rkey = record.uri.split("/").pop();
							if (!rkey) return null;

							const cardCount = record.value.cards.reduce(
								(sum, card) => sum + card.quantity,
								0,
							);
							const updatedDate = record.value.updatedAt
								? new Date(record.value.updatedAt).toLocaleDateString()
								: new Date(record.value.createdAt).toLocaleDateString();

							return (
								<Link
									key={record.uri}
									to="/profile/$did/deck/$rkey"
									params={{ did, rkey: asRkey(rkey) }}
									className="block p-6 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors"
								>
									<h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
										{record.value.name}
									</h2>
									{record.value.format && (
										<p className="text-sm text-gray-600 dark:text-gray-400 mb-2 capitalize">
											{record.value.format}
										</p>
									)}
									<div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
										<span>{cardCount} cards</span>
										<span>Updated {updatedDate}</span>
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
