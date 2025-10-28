import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { getCanonicalPrintingQueryOptions } from "../../lib/queries";
import type { OracleId } from "../../lib/scryfall-types";
import { isOracleId } from "../../lib/scryfall-types";

export const Route = createFileRoute("/cards/$oracleId")({
	ssr: false,
	component: CardOracleRedirect,
});

function CardOracleRedirect() {
	const { oracleId } = Route.useParams();

	const isValidId = isOracleId(oracleId);
	const { data: scryfallId, isLoading } = useQuery(
		getCanonicalPrintingQueryOptions(isValidId ? oracleId : ("" as OracleId)),
	);

	if (!isValidId) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-red-400 text-lg">Invalid oracle ID format</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-gray-400 text-lg">Loading...</p>
			</div>
		);
	}

	if (!scryfallId) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-red-400 text-lg">Card not found</p>
			</div>
		);
	}

	return (
		<Navigate
			to="/cards/$oracleId/$scryfallId"
			params={{ oracleId, scryfallId }}
		/>
	);
}
