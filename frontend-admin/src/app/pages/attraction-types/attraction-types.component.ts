import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { AttractionsService } from '../../services/attractions.service';
import { AttractionType } from '../../interfaces';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-attraction-types',
  imports: [
    FormsModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './attraction-types.component.html',
  styleUrl: './attraction-types.component.scss',
})
export class AttractionTypesComponent implements OnInit {
  private readonly attractionsService = inject(AttractionsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns: string[] = ['name', 'slug', 'actions'];
  dataSource = new MatTableDataSource<AttractionType>([]);

  loading = signal(false);
  newTypeName = signal('');
  editingId = signal<number | null>(null);
  editingName = signal('');

  ngOnInit(): void {
    this.loadTypes();
  }

  loadTypes(): void {
    this.loading.set(true);
    this.attractionsService
      .getAttractionTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.types;
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to load types', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
        },
      });
  }

  addType(): void {
    const name = this.newTypeName().trim();
    if (!name) return;

    this.attractionsService
      .createAttractionType(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Type created successfully', 'Close', { duration: 3000 });
          this.newTypeName.set('');
          this.loadTypes();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to create type', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }

  startEditing(type: AttractionType): void {
    this.editingId.set(type.id);
    this.editingName.set(type.name);
  }

  cancelEditing(): void {
    this.editingId.set(null);
    this.editingName.set('');
  }

  saveEdit(type: AttractionType): void {
    const name = this.editingName().trim();
    if (!name) return;

    this.attractionsService
      .updateAttractionType(type.id, name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Type updated successfully', 'Close', { duration: 3000 });
          this.editingId.set(null);
          this.editingName.set('');
          this.loadTypes();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to update type', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }

  deleteType(type: AttractionType): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Type',
        message: `Are you sure you want to delete "${type.name}"? This will remove it from all attractions.`,
        confirmText: 'Delete',
        icon: 'delete',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => this.attractionsService.deleteAttractionType(type.id)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Type deleted successfully', 'Close', { duration: 3000 });
          this.loadTypes();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to delete type', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }
}
