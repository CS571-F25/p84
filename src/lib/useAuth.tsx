import type { ActorIdentifier, Did } from "@atcute/lexicons";
import {
	createAuthorizationUrl,
	getSession,
	OAuthUserAgent,
	type Session,
} from "@atcute/oauth-browser-client";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { initializeOAuth } from "./oauth-config";

const STORAGE_KEY = "deckbelcher:last-did";

interface AuthContextValue {
	session: Session | null;
	agent: OAuthUserAgent | null;
	signIn: (handle: string) => Promise<void>;
	signOut: () => Promise<void>;
	setAuthSession: (session: Session) => void;
	isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [agent, setAgent] = useState<OAuthUserAgent | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		initializeOAuth();

		const restoreSession = async () => {
			try {
				const lastDid = localStorage.getItem(STORAGE_KEY);
				if (lastDid) {
					const stored = await getSession(lastDid as Did, { allowStale: true });
					if (stored) {
						setSession(stored);
						setAgent(new OAuthUserAgent(stored));
					}
				}
			} catch (error) {
				console.error("Failed to restore session:", error);
			} finally {
				setIsLoading(false);
			}
		};

		restoreSession();
	}, []);

	const signIn = async (handle: string) => {
		const authUrl = await createAuthorizationUrl({
			target: { type: "account", identifier: handle as ActorIdentifier },
			scope: import.meta.env.VITE_OAUTH_SCOPE,
		});

		window.location.assign(authUrl);
	};

	const signOut = async () => {
		if (agent) {
			await agent.signOut();
		}
		localStorage.removeItem(STORAGE_KEY);
		setSession(null);
		setAgent(null);
	};

	const setAuthSession = (newSession: Session) => {
		localStorage.setItem(STORAGE_KEY, newSession.info.sub);
		setSession(newSession);
		setAgent(new OAuthUserAgent(newSession));
	};

	return (
		<AuthContext.Provider
			value={{ session, agent, signIn, signOut, isLoading, setAuthSession }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
