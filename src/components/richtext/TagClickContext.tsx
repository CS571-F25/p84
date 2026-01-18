import { createContext, useContext } from "react";

interface TagClickContextValue {
	onTagClick?: (tag: string) => void;
}

const TagClickContext = createContext<TagClickContextValue>({});

export function useTagClick() {
	return useContext(TagClickContext);
}

export { TagClickContext };
