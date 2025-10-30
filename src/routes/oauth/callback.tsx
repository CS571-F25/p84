import { finalizeAuthorization } from "@atcute/oauth-browser-client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/oauth/callback")({
	component: OAuthCallback,
});

function OAuthCallback() {
	const navigate = useNavigate();
	const { setAuthSession } = useAuth();
	const [error, setError] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount to prevent infinite loop
	useEffect(() => {
		const handleCallback = async () => {
			try {
				const params = new URLSearchParams(location.hash.slice(1));
				history.replaceState(null, "", location.pathname + location.search);

				const { session } = await finalizeAuthorization(params);
				setAuthSession(session);

				navigate({ to: "/" });
			} catch (err) {
				console.error("OAuth callback error:", err);
				setError(
					err instanceof Error ? err.message : "Failed to complete sign in",
				);
			}
		};

		handleCallback();
	}, []);

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
				<div className="max-w-md p-6 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg shadow-lg">
					<h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
						Sign In Failed
					</h1>
					<p className="text-gray-900 dark:text-white mb-4">{error}</p>
					<button
						type="button"
						onClick={() => navigate({ to: "/" })}
						className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
					>
						Return Home
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
			<div className="text-center">
				<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-600 border-r-transparent mb-4" />
				<p className="text-gray-900 dark:text-white text-lg">
					Completing sign in...
				</p>
			</div>
		</div>
	);
}
