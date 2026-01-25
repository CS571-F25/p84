import { useQuery } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";
import { CardImage } from "./CardImage";

interface HoverState {
	cardId: ScryfallId;
	position: { x: number; y: number };
}

interface HoverCardPreviewContextValue {
	showPreview: (cardId: ScryfallId, e: React.MouseEvent) => void;
	updatePosition: (e: React.MouseEvent) => void;
	hidePreview: () => void;
}

const HoverCardPreviewContext =
	createContext<HoverCardPreviewContextValue | null>(null);

export function useHoverCardPreview() {
	return useContext(HoverCardPreviewContext);
}

/**
 * Hook for card hover preview that auto-cleans up on unmount.
 * Returns props to spread on the hoverable element.
 */
export function useCardHover(cardId: ScryfallId) {
	const ctx = useContext(HoverCardPreviewContext);

	useEffect(() => {
		return () => ctx?.hidePreview();
	}, [ctx]);

	return useMemo(
		() => ({
			onMouseEnter: (e: React.MouseEvent) => ctx?.showPreview(cardId, e),
			onMouseMove: (e: React.MouseEvent) => ctx?.updatePosition(e),
			onMouseLeave: () => ctx?.hidePreview(),
		}),
		[ctx, cardId],
	);
}

interface HoverCardPreviewProviderProps {
	children: ReactNode;
}

export function HoverCardPreviewProvider({
	children,
}: HoverCardPreviewProviderProps) {
	const [hover, setHover] = useState<HoverState | null>(null);

	const showPreview = useCallback((cardId: ScryfallId, e: React.MouseEvent) => {
		setHover({ cardId, position: { x: e.clientX, y: e.clientY } });
	}, []);

	const updatePosition = useCallback((e: React.MouseEvent) => {
		setHover((prev) =>
			prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null,
		);
	}, []);

	const hidePreview = useCallback(() => {
		setHover(null);
	}, []);

	const contextValue = useMemo(
		() => ({ showPreview, updatePosition, hidePreview }),
		[showPreview, updatePosition, hidePreview],
	);

	return (
		<HoverCardPreviewContext.Provider value={contextValue}>
			{children}
			{hover && <HoverCardPreviewPortal hover={hover} />}
		</HoverCardPreviewContext.Provider>
	);
}

const PREVIEW_WIDTH = 256; // w-64
const CARD_ASPECT = 7 / 5; // height = width * 1.4
const PADDING = 16;

interface HoverCardPreviewPortalProps {
	hover: HoverState;
}

function HoverCardPreviewPortal({ hover }: HoverCardPreviewPortalProps) {
	const { data: card } = useQuery(getCardByIdQueryOptions(hover.cardId));

	if (typeof window === "undefined" || !card) return null;

	const previewHeight = PREVIEW_WIDTH * CARD_ASPECT;
	const { innerWidth: vw, innerHeight: vh } = window;

	// Position below and to the right of cursor
	let left = hover.position.x + PADDING;
	let top = hover.position.y + PADDING;

	// Flip to left if would overflow right
	if (left + PREVIEW_WIDTH > vw - PADDING) {
		left = hover.position.x - PREVIEW_WIDTH - PADDING;
	}

	// Flip above cursor if would overflow bottom
	if (top + previewHeight > vh - PADDING) {
		top = hover.position.y - previewHeight - PADDING;
	}

	// Final clamp to viewport
	left = Math.max(PADDING, Math.min(left, vw - PREVIEW_WIDTH - PADDING));
	top = Math.max(PADDING, Math.min(top, vh - previewHeight - PADDING));

	return createPortal(
		<div className="fixed z-50 pointer-events-none w-64" style={{ left, top }}>
			<CardImage
				card={card}
				size="normal"
				outerClassName="w-full"
				imgClassName="shadow-2xl shadow-black/50"
			/>
		</div>,
		document.body,
	);
}
