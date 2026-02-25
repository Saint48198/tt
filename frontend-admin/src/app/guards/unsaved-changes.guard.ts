import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { HasUnsavedChanges } from '@shared/services';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../components/confirm-dialog/confirm-dialog.component';

/**
 * Route guard that prompts the user with a Material confirmation dialog
 * when they try to navigate away from a page with unsaved changes.
 *
 * Usage in routes:
 * {
 *   path: 'edit/:id',
 *   component: EditComponent,
 *   canDeactivate: [unsavedChangesGuard],
 * }
 *
 * The component must implement HasUnsavedChanges:
 *   hasUnsavedChanges(): boolean { return this.form.dirty; }
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }

  const dialog = inject(MatDialog);

  const data: ConfirmDialogData = {
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Are you sure you want to leave this page?',
    confirmText: 'Leave',
    cancelText: 'Stay',
    icon: 'warning',
    color: 'warn',
  };

  return dialog
    .open(ConfirmDialogComponent, {
      data,
      width: '420px',
      disableClose: true,
      autoFocus: false,
      panelClass: 'confirm-dialog-panel',
    })
    .afterClosed()
    .pipe(map((result) => result === true));
};

