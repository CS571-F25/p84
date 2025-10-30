import { finalizeAuthorization } from "@atcute/oauth-browser-client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/oauth/callback")({
	component: OAuthCallback,
	ssr: false,
});

function OAuthCallback() {
	const navigate = useNavigate();
	const { setAuthSession } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const hasProcessedRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount to prevent infinite loop
	useEffect(() => {
		// Reentrancy: if we've already processed, bail early (React 18 StrictMode runs effects twice)
		// this is really really gross / bad, but there isn't another good way to do this since we need to do something on mount with
		// a side effect (removing the params) that we dont want to reverse for security
		//
		// ideally you would not do this anywhere else. in other cases, reference:
		// https://react.dev/learn/synchronizing-with-effects#not-an-effect-initializing-the-application
		// https://react.dev/learn/you-might-not-need-an-effect
		if (hasProcessedRef.current) {
			return;
		}
		hasProcessedRef.current = true;

		const handleCallback = async () => {
			try {
				const params = new URLSearchParams(location.hash.slice(1));

				if (!params.has("state") || !params.has("code")) {
					setError(
						"Missing authentication parameters. Please try signing in again.",
					);
					return;
				}

				history.replaceState(null, "", location.pathname + location.search);

				const { session } = await finalizeAuthorization(params);
				setAuthSession(session);

				navigate({ to: "/" });
			} catch (err) {
				console.error("OAuth callback error:", err);
				const message =
					err instanceof Error
						? err.message
						: "An unexpected error occurred during sign in";
				setError(message);
			}
		};

		handleCallback();
	}, []);

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 p-4">
				<div className="max-w-md w-full bg-white dark:bg-slate-800 border border-red-300 dark:border-red-800 rounded-lg shadow-lg overflow-hidden">
					<div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-6">
						<h1 className="text-2xl font-bold text-red-700 dark:text-red-400">
							Sign In Failed
						</h1>
					</div>
					<div className="p-6">
						<p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
							{error}
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => navigate({ to: "/signin" })}
								className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
							>
								Try Again
							</button>
							<button
								type="button"
								onClick={() => navigate({ to: "/" })}
								className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
							>
								Return Home
							</button>
						</div>
					</div>
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
