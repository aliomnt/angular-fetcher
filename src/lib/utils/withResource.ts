import { MutationHandlers, WithResourceOptions } from "../models";
import { inject, DestroyRef, Signal, signal, computed } from "@angular/core";
import { Observable, Subject, defer, throwError } from "rxjs";
import { catchError, finalize, takeUntil, take } from "rxjs/operators";

/**
 * Extended options for `withResource`.
 *
 * @typeParam T Type of the resource data.
 */
interface ExtendedWithResourceOptions<T> extends WithResourceOptions {
  /**
   * Initial value used when no resource has been loaded or after invalidation.
   */
  emptyValue: T;
}

/**
 * Manages API data with reactive signals in Angular applications.
 *
 * @public
 * @typeParam T Resource data type.
 * @typeParam E Error type (default: unknown).
 *
 * @param loader A method that returns `Observable<T>` (e.g., from a service method).
 * @param options Optional configuration, including `destroy$` for cleanup.
 *
 * @returns Resource controller with reactive state and methods:
 *   - `state`: Signals for data, loading, and error.
 *   - `fetch()`: Fetches data.
 *   - `update()`: Updates local data.
 *   - `withMutation()`: Executes mutations with optional optimistic updates.
 *   - `invalidate()`: Clears and refetches data.
 *   - `abort()`: Cancels ongoing requests.
 *
 * @example
 * ```ts
 * // user.service.ts
 * export class UserService {
 *   getUser() { return this.http.get('/api/user'); }
 *   updateUser(data) { return this.http.put('/api/user', data); }
 *   userResource = withResource(() => this.getUser());
 * }
 *
 * // user.component.ts
 * userResource.fetch();
 * userResource.withMutation(updateUser({ name: 'foo' }), {
 *   key: 'update-user',
 *   optimisticUpdate: (prev) => ({ ...prev, name: 'foo' })
 * });
 * ```
 */
export function withResource<T, E = unknown>(
  loader: () => Observable<T>,
  options: ExtendedWithResourceOptions<T> = { emptyValue: null as T }
) {
  const _data = signal<T>(options.emptyValue);
  const _fetchLoading = signal(false);
  const _mutationLoading = signal(false);
  const _mutationLoadingKey = signal<{ [key: string]: boolean }>({});
  const _error = signal<E | null>(null);
  const abort$ = new Subject<void>();
  const _isEmpty = computed(() => {
    const data = _data();
    if (data === null || data === undefined) {
      return true;
    }
    if (typeof data === "string") {
      return data.length === 0;
    }
    if (Array.isArray(data)) {
      return data.length === 0;
    }
    if (typeof data === "object" && data !== null) {
      return Object.keys(data).length === 0;
    }
    return false;
  });

  const destroyRef = inject(DestroyRef, { optional: true });
  const fallbackDestroy$ = destroyRef
    ? new Observable<void>((subscriber) => {
        destroyRef.onDestroy(() => subscriber.next());
      })
    : null;
  const destroy$ = options.destroy$ ?? fallbackDestroy$;

  if (destroy$) {
    destroy$.pipe(take(1)).subscribe(() => {
      abort$.next();
      abort$.complete();
    });
  }

  /**
   * Reactive state of the resource.
   * @public
   */
  const state = {
    /** Current resource data. */
    data: _data as Signal<T>,
    /** Fetch operation status. */
    fetchLoading: _fetchLoading as Signal<boolean>,
    /** Mutation operation status. */
    mutationLoading: _mutationLoading as Signal<boolean>,
    /** Individual mutation loading states by key. */
    mutationLoadingKey: _mutationLoadingKey as Signal<{
      [key: string]: boolean;
    }>,
    /** Latest error, if any. */
    error: _error as Signal<E | null>,
    /** Whether resource data is empty. */
    isEmpty: _isEmpty as Signal<boolean>,
  };

  let currentRequestId = 0;

  /**
   * Fetches resource data, canceling ongoing requests.
   *
   * @public
   * @param handlers Optional success and error callbacks.
   */
  const fetch = (handlers?: {
    next?: (res: T) => void;
    error?: (err: any) => void;
  }) => {
    abort$.next();
    _fetchLoading.set(true);
    _error.set(null);
    const requestId = ++currentRequestId;

    defer(loader)
      .pipe(
        takeUntil(abort$),
        destroy$ ? takeUntil(destroy$) : (source$: Observable<T>) => source$,
        catchError((err) => {
          _error.set(err);
          handlers?.error?.(err);
          return throwError(() => err);
        }),
        finalize(() => _fetchLoading.set(false))
      )
      .subscribe({
        next: (value) => {
          if (requestId === currentRequestId) {
            _data.set(value);
            handlers?.next?.(value);
          }
        },
      });
  };

  /**
   * Updates resource data with provided function.
   *
   * @public
   * @param updater Function to transform current data.
   */
  const update = (updater: (prev: T) => T) => {
    _data.update(updater);
  };

  /**
   * Executes a mutation with optional optimistic updates.
   *
   * @public
   * @param request$ Observable for the mutation request.
   * @param handlers Mutation configuration and callbacks.
   * @typeParam R Mutation response type.
   */
  const withMutation = <R>(
    request$: Observable<R>,
    handlers: MutationHandlers<R, T>
  ) => {
    const key = handlers.key || `mutation-${Date.now()}`;
    _mutationLoadingKey.set({ ..._mutationLoadingKey(), [key]: true });
    _mutationLoading.set(true);
    _error.set(null);

    const previousState = _data();

    if (handlers.optimisticUpdate) {
      _data.update((prev) => handlers.optimisticUpdate!(prev, {} as R));
    }

    request$
      .pipe(
        takeUntil(abort$),
        destroy$ ? takeUntil(destroy$) : (source$: Observable<R>) => source$,
        finalize(() => {
          _mutationLoadingKey.set({ ..._mutationLoadingKey(), [key]: false });
          _mutationLoading.set(
            Object.values(_mutationLoadingKey()).some((v) => v)
          );
        })
      )
      .subscribe({
        next: (res) => {
          if (handlers.invalidate) {
            invalidate();
          }
          handlers.next?.(res);
        },
        error: (err) => {
          if (handlers.optimisticUpdate) {
            _data.set(previousState);
          }
          _error.set(err);
          handlers.error?.(err);
        },
      });
  };

  /**
   * Invalidates resource data and refetches.
   * @public
   */
  const invalidate = () => {
    _data.set(options.emptyValue);
    fetch();
  };

  /**
   * Cancels all operations and resets loading states.
   * @public
   */
  const abort = () => {
    abort$.next();
    _fetchLoading.set(false);
    _mutationLoading.set(false);
    _mutationLoadingKey.set({});
  };

  return {
    state,
    fetch,
    update,
    withMutation,
    invalidate,
    abort,
  };
}
