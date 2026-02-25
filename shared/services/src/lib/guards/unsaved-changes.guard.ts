/**
 * Interface that components must implement to work with the unsaved-changes guard.
 */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}
