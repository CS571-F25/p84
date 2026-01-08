import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$did/list/$rkey")({
	component: () => <Outlet />,
});
