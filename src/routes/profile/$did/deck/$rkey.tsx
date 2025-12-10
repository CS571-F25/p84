import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$did/deck/$rkey")({
	component: () => <Outlet />,
});
