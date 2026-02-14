// ---------------------------------------------------------------------------
// DirtyTracker — per-panel state tracker for applied vs. current values
// ---------------------------------------------------------------------------

/**
 * Generic tracker that holds two copies of a state value: the last-applied
 * snapshot and the current (possibly edited) value.  Exposes `isDirty` for
 * the UI to show "Apply" / "Undo" controls.
 *
 * Uses deep JSON comparison — suitable for the small, serializable config
 * objects each panel manages.
 *
 * @example
 * ```ts
 * const tracker = new DirtyTracker<FilterGroup>(emptyFilterGroup());
 * tracker.current = { …modified… };
 * console.log(tracker.isDirty); // true
 * tracker.apply();              // snapshots current → applied
 * console.log(tracker.isDirty); // false
 * ```
 */
export class DirtyTracker<T> {
  /** The last-applied (confirmed) value. */
  private _applied: T;

  /** The current (possibly edited) value. */
  private _current: T;

  /** Serialized form of `_applied` for fast comparison. */
  private _appliedJson: string;

  constructor(initial: T) {
    this._applied = structuredClone(initial);
    this._current = structuredClone(initial);
    this._appliedJson = JSON.stringify(initial);
  }

  // ----- Accessors --------------------------------------------------------

  get applied(): T {
    return this._applied;
  }

  get current(): T {
    return this._current;
  }

  set current(value: T) {
    this._current = value;
  }

  /**
   * `true` when `current` differs from `applied` (deep comparison).
   */
  get isDirty(): boolean {
    return JSON.stringify(this._current) !== this._appliedJson;
  }

  // ----- Mutations --------------------------------------------------------

  /**
   * Confirm the current value — snapshot it as the new applied state.
   * Returns the newly applied value.
   */
  apply(): T {
    this._applied = structuredClone(this._current);
    this._appliedJson = JSON.stringify(this._applied);
    return this._applied;
  }

  /**
   * Revert current back to the last-applied value, discarding edits.
   */
  undo(): void {
    this._current = structuredClone(this._applied);
  }

  /**
   * Hard-reset both applied and current to a new initial value.
   * Typically called when the underlying dataset changes.
   */
  reset(initial: T): void {
    this._applied = structuredClone(initial);
    this._current = structuredClone(initial);
    this._appliedJson = JSON.stringify(initial);
  }
}
