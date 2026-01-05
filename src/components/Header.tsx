import { Link, useLocation } from "@tanstack/react-router";
import { Home, Library, LogIn, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useState } from "react";
import { RETURN_TO_KEY, useAuth } from "@/lib/useAuth";
import { useTheme } from "@/lib/useTheme";
import UserMenu from "./UserMenu";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const { theme, toggleTheme } = useTheme();
	const { session, isLoading } = useAuth();
	const location = useLocation();

	const handleSignInClick = () => {
		if (location.pathname !== "/signin") {
			sessionStorage.setItem(RETURN_TO_KEY, location.href);
		}
	};

	return (
		<>
			<header className="p-4 flex items-center bg-gray-800 dark:bg-gray-900 text-white shadow-lg">
				<div className="flex items-center">
					<button
						type="button"
						onClick={() => setIsOpen(true)}
						className="p-2 hover:bg-gray-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Open menu"
					>
						<Menu size={24} />
					</button>
					<h1 className="ml-4 text-xl font-semibold">
						<Link to="/">DeckBelcher</Link>
					</h1>
				</div>

				<div className="flex-1 flex justify-center px-4">
					<Link
						to="/cards"
						search={{ q: "" }}
						className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors text-white text-sm font-medium"
					>
						<Search size={18} />
						<span className="hidden sm:inline">Search Cards</span>
					</Link>
				</div>

				<div className="flex items-center gap-2">
					{!isLoading &&
						(session ? (
							<UserMenu />
						) : (
							<Link
								to="/signin"
								onClick={handleSignInClick}
								className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
							>
								<LogIn size={16} />
								<span className="text-sm font-medium">Sign In</span>
							</Link>
						))}
					<button
						type="button"
						onClick={toggleTheme}
						className="p-2 hover:bg-gray-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Toggle theme"
					>
						{theme === "dark" ? (
							<Sun size={20} />
						) : theme === "light" ? (
							<Moon size={20} />
						) : (
							<div className="w-5 h-5" />
						)}
					</button>
				</div>
			</header>

			{isOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-40"
					onClick={() => setIsOpen(false)}
					onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
					aria-hidden="true"
				/>
			)}

			<aside
				className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h2 className="text-xl font-bold">Navigation</h2>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Close menu"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 p-4 overflow-y-auto">
					<Link
						to="/"
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-2"
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2 text-white",
						}}
					>
						<Home size={20} />
						<span className="font-medium">Home</span>
					</Link>

					<Link
						to="/cards"
						search={{ q: "" }}
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-2"
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2 text-white",
						}}
					>
						<Library size={20} />
						<span className="font-medium">Card Browser</span>
					</Link>
				</nav>
			</aside>
		</>
	);
}
