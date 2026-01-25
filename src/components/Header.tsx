import { Link, useLocation } from "@tanstack/react-router";
import {
	FolderPlus,
	Home,
	Import,
	List,
	LogIn,
	Menu,
	Moon,
	Rows3,
	Search,
	Sun,
	X,
} from "lucide-react";
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
		if (location.pathname !== "/signin" && location.pathname !== "/signup") {
			sessionStorage.setItem(RETURN_TO_KEY, location.href);
		}
	};

	return (
		<>
			<header className="p-2 sm:p-4 flex items-center bg-zinc-800 dark:bg-zinc-950 text-white shadow-lg">
				<div className="flex items-center">
					<button
						type="button"
						onClick={() => setIsOpen(true)}
						className="p-2 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-lg transition-colors"
						aria-label="Open menu"
					>
						<Menu size={24} />
					</button>
					<h1
						className="ml-2 sm:ml-4 text-lg sm:text-xl font-medium hidden sm:block font-display"
						style={{
							fontVariationSettings: '"WONK" 1, "SOFT" 70, "opsz" 20',
						}}
					>
						<Link to="/">deck belcher</Link>
					</h1>
				</div>

				<div className="flex-1 flex justify-center px-2 sm:px-4">
					<Link
						to="/cards"
						search={{ q: "", sort: undefined, sort2: undefined }}
						className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors text-gray-900 text-sm font-medium"
					>
						<Search size={18} />
						<span className="hidden sm:inline">Search Cards</span>
					</Link>
				</div>

				<div className="flex items-center gap-2">
					{isLoading ? (
						<div className="flex items-center gap-2 px-3 py-2 bg-zinc-700 dark:bg-zinc-800 rounded-lg animate-pulse">
							<LogIn size={16} className="invisible" />
							<span className="text-sm font-medium invisible">Sign In</span>
						</div>
					) : session ? (
						<UserMenu />
					) : (
						<Link
							to="/signin"
							onClick={handleSignInClick}
							className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-cyan-400 hover:bg-cyan-300 text-gray-900 rounded-lg transition-colors"
						>
							<LogIn size={16} />
							<span className="text-sm font-medium hidden sm:inline">
								Sign In
							</span>
						</Link>
					)}
					<button
						type="button"
						onClick={toggleTheme}
						className="p-2 hover:bg-zinc-700 dark:hover:bg-zinc-800 rounded-lg transition-colors"
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
				className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
					isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
				}`}
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-600">
					<h2 className="text-xl font-bold">Navigation</h2>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
						aria-label="Close menu"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 p-4 overflow-y-auto">
					<Link
						to="/"
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
						inactiveProps={{
							className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
						}}
						activeProps={{
							className: "bg-cyan-700 hover:bg-cyan-600 text-white",
						}}
					>
						<Home size={20} />
						<span className="font-medium">Home</span>
					</Link>

					<Link
						to="/cards"
						search={{ q: "", sort: undefined, sort2: undefined }}
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
						inactiveProps={{
							className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
						}}
						activeProps={{
							className: "bg-cyan-700 hover:bg-cyan-600 text-white",
						}}
					>
						<Search size={20} />
						<span className="font-medium">Card Browser</span>
					</Link>

					{session && (
						<>
							<div className="border-t border-gray-200 dark:border-zinc-700 my-3" />

							<Link
								to="/deck/new"
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
								inactiveProps={{
									className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
								}}
								activeProps={{
									className: "bg-cyan-700 hover:bg-cyan-600 text-white",
								}}
							>
								<FolderPlus size={20} />
								<span className="font-medium">New Deck</span>
							</Link>

							<Link
								to="/deck/import"
								search={{ format: undefined }}
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
								inactiveProps={{
									className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
								}}
								activeProps={{
									className: "bg-cyan-700 hover:bg-cyan-600 text-white",
								}}
							>
								<Import size={20} />
								<span className="font-medium">Import Deck</span>
							</Link>

							<div className="border-t border-gray-200 dark:border-zinc-700 my-3" />

							<Link
								to="/profile/$did"
								params={{ did: session.info.sub }}
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
								inactiveProps={{
									className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
								}}
								activeProps={{
									className: "bg-cyan-700 hover:bg-cyan-600 text-white",
								}}
							>
								<Rows3 size={20} />
								<span className="font-medium">My Decks</span>
							</Link>

							<Link
								to="/profile/$did/lists"
								params={{ did: session.info.sub }}
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
								inactiveProps={{
									className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
								}}
								activeProps={{
									className: "bg-cyan-700 hover:bg-cyan-600 text-white",
								}}
							>
								<List size={20} />
								<span className="font-medium">My Lists</span>
							</Link>
						</>
					)}

					{!session && !isLoading && (
						<>
							<div className="border-t border-gray-200 dark:border-zinc-700 my-3" />

							<Link
								to="/signin"
								onClick={() => {
									handleSignInClick();
									setIsOpen(false);
								}}
								className="flex items-center gap-3 p-3 rounded-lg transition-colors mb-2"
								inactiveProps={{
									className: "hover:bg-gray-100 dark:hover:bg-zinc-800",
								}}
								activeProps={{
									className: "bg-cyan-700 hover:bg-cyan-600 text-white",
								}}
							>
								<LogIn size={20} />
								<span className="font-medium">Sign In</span>
							</Link>
						</>
					)}
				</nav>
			</aside>
		</>
	);
}
