/**
 * Configuration for mutation handlers used in the `withMutation` method.
 *
 * @typeParam R The type of the mutation response.
 * @typeParam T The type of the resource data.
 */
export interface MutationHandlers<R, T> {
    /** A unique key to identify the mutation (optional, defaults to a timestamp-based key). */
    key?: string;
    /** Callback invoked on successful mutation (optional). */
    next?: (res: R) => void;
    /** Callback invoked on mutation error (optional). */
    error?: (err: any) => void;
    /** Function to perform an optimistic update before the mutation completes (optional). */
    optimisticUpdate?: (prev: T, res: R) => T;
    /** Whether to invalidate the resource data after a successful mutation (optional). */
    invalidate?: boolean;
}
