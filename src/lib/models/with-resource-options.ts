import { Observable } from 'rxjs';

/**
 * Configuration options for the `withResource` utility.
 */
export interface WithResourceOptions {
    /** An optional Observable to trigger cleanup when the resource is destroyed. */
    destroy$?: Observable<void>;
}
