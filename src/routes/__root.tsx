import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import Header from "../components/Header";
import { WorkerStatusIndicator } from "../components/WorkerStatusIndicator";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { initializeApp } from "../lib/app-init";
import { AuthProvider } from "../lib/useAuth";
import { ThemeProvider, useTheme } from "../lib/useTheme";
import appCss from "../styles.css?url";

initializeApp();

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "DeckBelcher",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	notFoundComponent: () => (
		<div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 p-4">
			<div className="text-center">
				<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
					404
				</h1>
				<p className="text-gray-600 dark:text-gray-400 mb-6">Page not found</p>
			</div>
		</div>
	),

	shellComponent: RootDocument,
});

function ThemedToaster() {
	const { theme } = useTheme();
	return <Toaster theme={theme} />;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		// suppressHydrationWarning: blocking script adds theme class before hydration,
		// so className will differ between server (no class) and client (has dark/light)
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				{/* Blocking script to set theme class before React hydrates - prevents flash */}
				<script>
					{`
						(function() {
							const stored = localStorage.getItem('theme');
							const theme = stored === 'dark' || stored === 'light'
								? stored
								: window.matchMedia('(prefers-color-scheme: dark)').matches
									? 'dark'
									: 'light';
							document.documentElement.classList.add(theme);
						})();
					`}
				</script>
			</head>
			<body>
				<ThemeProvider>
					<AuthProvider>
						<WorkerStatusIndicator />
						<Header />
						{children}
						<TanStackDevtools
							config={{
								position: "bottom-right",
							}}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
								TanStackQueryDevtools,
							]}
						/>
						<ThemedToaster />
					</AuthProvider>
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}
