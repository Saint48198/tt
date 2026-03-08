import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  color?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-header">
        @if (data.icon) {
          <mat-icon class="confirm-icon" [class]="data.color || 'warn'">{{ data.icon }}</mat-icon>
        }
        <h2>{{ data.title || 'Confirm' }}</h2>
      </div>
      <p class="confirm-message">{{ data.message || 'Are you sure?' }}</p>
      <div class="confirm-actions">
        <button mat-stroked-button (click)="dialogRef.close(false)">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button mat-raised-button [color]="data.color || 'warn'" (click)="dialogRef.close(true)">
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .confirm-dialog {
        padding: 24px;
      }
      .confirm-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 1rem;

        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 500;
        }
      }
      .confirm-icon {
        &.warn {
          color: #f44336;
        }
        &.primary {
          color: #3f51b5;
        }
        &.accent {
          color: #ff4081;
        }
      }
      .confirm-message {
        font-size: 0.9375rem;
        color: #555;
        margin: 0 0 1.5rem;
      }
      .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
}
