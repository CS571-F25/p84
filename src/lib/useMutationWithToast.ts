import type {
	UseMutationOptions,
	UseMutationResult,
} from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface MutationWithToastOptions<TData, TError, TVariables, TContext>
	extends UseMutationOptions<TData, TError, TVariables, TContext> {
	/**
	 * Custom error message to show in toast.
	 * Can be a string or a function that formats the error.
	 * If not provided, will use error.message or a default message.
	 */
	errorMessage?: string | ((error: TError) => string);
}

/**
 * Wrapper around useMutation that automatically shows error toasts
 * Use this for all mutations to ensure consistent error handling
 */
export function useMutationWithToast<
	TData = unknown,
	TError = Error,
	TVariables = void,
	TContext = unknown,
>(
	options: MutationWithToastOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
	const { errorMessage, onError, ...mutationOptions } = options;

	return useMutation({
		...mutationOptions,
		onError: (error, variables, context, mutation) => {
			let message: string;
			if (typeof errorMessage === "function") {
				message = errorMessage(error);
			} else if (typeof errorMessage === "string") {
				message = errorMessage;
			} else if (error instanceof Error) {
				message = error.message;
			} else {
				message = "An unexpected error occurred";
			}

			toast.error(message);

			// Call the original onError if provided
			onError?.(error, variables, context, mutation);
		},
	});
}
