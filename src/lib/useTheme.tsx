import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
	theme: Theme | undefined;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
	/**
	 * Start with undefined to avoid SSR hydration mismatch.
	 *
	 * The blocking script in __root.tsx sets the theme class on <html> before React
	 * hydrates, which prevents the flash. However, we can't know the theme value during
	 * SSR (server doesn't have access to localStorage or system preferences).
	 *
	 * By starting with undefined on both server and client, we avoid hydration errors.
	 * Components that depend on theme should handle undefined by not rendering
	 * theme-specific content until it loads (e.g., theme toggle icon).
	 *
	 * This gives us the best of both worlds:
	 * - No flash (blocking script sets CSS immediately)
	 * - No hydration error (state is undefined on both sides until client loads)
	 */
	const [theme, setThemeState] = useState<Theme | undefined>(undefined);

	// Read theme from DOM after mount (set by blocking script)
	useEffect(() => {
		const currentTheme = document.documentElement.classList.contains("dark")
			? "dark"
			: "light";
		setThemeState(currentTheme);
	}, []);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		localStorage.setItem("theme", newTheme);
	};

	const toggleTheme = () => {
		if (!theme) return; // Don't toggle if theme hasn't loaded yet
		setTheme(theme === "light" ? "dark" : "light");
	};

	// Apply theme class to document
	useEffect(() => {
		if (!theme) return; // Don't update DOM until theme is loaded
		const root = document.documentElement;
		root.classList.remove("light", "dark");
		root.classList.add(theme);
	}, [theme]);

	// Sync theme changes across tabs
	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (
				e.key === "theme" &&
				(e.newValue === "light" || e.newValue === "dark")
			) {
				setThemeState(e.newValue);
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return context;
}
