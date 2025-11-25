import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveHandleToDid } from "@/lib/identity";

export const Route = createFileRoute("/u/$handle")({
	loader: async ({ params }) => {
		const did = await resolveHandleToDid(params.handle);
		throw redirect({
			to: "/profile/$did",
			params: { did },
		});
	},
});
