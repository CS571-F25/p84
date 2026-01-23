import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, Check, Copy, Home, RefreshCw } from "lucide-react";
import { useState } from "react";

export function RouteErrorComponent({
	error,
	info,
	reset,
}: ErrorComponentProps) {
	const router = useRouter();
	const [copied, setCopied] = useState(false);

	const copyErrorDetails = async () => {
		const details = [
			`Error: ${error.message}`,
			`URL: ${window.location.href}`,
			`Time: ${new Date().toISOString()}`,
			`User Agent: ${navigator.userAgent}`,
			"",
			"Stack Trace:",
			error.stack || "(no stack trace)",
			"",
			...(info?.componentStack
				? ["Component Stack:", info.componentStack]
				: []),
		].join("\n");

		await navigator.clipboard.writeText(details);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900 flex items-center justify-center p-6">
			<div className="max-w-4xl w-full">
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
					<div className="flex items-start gap-4">
						<div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
							<AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
						</div>
						<div className="flex-1 min-w-0">
							<h1 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
								Something went wrong
							</h1>
							<p className="text-red-700 dark:text-red-300 mb-4">
								{error.message || "An unexpected error occurred"}
							</p>

							<div className="flex flex-wrap gap-3 mb-4">
								<button
									type="button"
									onClick={() => {
										reset();
										router.invalidate();
									}}
									className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
								>
									<RefreshCw className="w-4 h-4" />
									Try again
								</button>
								<button
									type="button"
									onClick={copyErrorDetails}
									className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
								>
									{copied ? (
										<Check className="w-4 h-4" />
									) : (
										<Copy className="w-4 h-4" />
									)}
									{copied ? "Copied!" : "Copy details"}
								</button>
								<Link
									to="/"
									className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
								>
									<Home className="w-4 h-4" />
									Go home
								</Link>
							</div>

							{import.meta.env.DEV && (
								<div className="space-y-2">
									<pre className="text-xs bg-red-100 dark:bg-red-900/30 p-3 rounded overflow-x-auto text-red-800 dark:text-red-200 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
										{error.stack || error.message}
									</pre>
									{info?.componentStack && (
										<pre className="text-xs bg-red-100 dark:bg-red-900/30 p-3 rounded overflow-x-auto text-red-800 dark:text-red-200 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
											{info.componentStack}
										</pre>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
