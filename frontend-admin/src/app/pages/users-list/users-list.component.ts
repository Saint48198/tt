import { Component, OnInit, inject, signal, ViewChild, AfterViewInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UsersService } from '../../services/users.service';
import { User } from '../../interfaces';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-users-list',
  imports: [
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatChipsModule,
    MatSlideToggleModule,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent implements OnInit, AfterViewInit {
  private readonly usersService = inject(UsersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  displayedColumns: string[] = ['username', 'email', 'roles', 'actions'];
  dataSource = new MatTableDataSource<User>([]);

  total = signal(0);
  loading = signal(false);
  includeDisabled = signal(false);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadUsers();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  loadUsers(page = 1, limit = 25, sortBy: 'username' | 'email' | 'id' = 'username', sortOrder: 'asc' | 'desc' = 'asc'): void {
    this.loading.set(true);

    this.usersService
      .getUsers({
        page,
        limit,
        sortBy,
        sortOrder,
        includeDisabled: this.includeDisabled(),
      })
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.users;
          this.total.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to load users',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    const sortActive = this.sort?.active || 'username';
    const sortDirection = this.sort?.direction || 'asc';
    this.loadUsers(
      event.pageIndex + 1,
      event.pageSize,
      sortActive as 'username' | 'email' | 'id',
      sortDirection as 'asc' | 'desc'
    );
  }

  onSortChange(event: Sort): void {
    const pageIndex = this.paginator?.pageIndex || 0;
    const pageSize = this.paginator?.pageSize || 25;
    this.loadUsers(
      pageIndex + 1,
      pageSize,
      event.active as 'username' | 'email' | 'id',
      (event.direction || 'asc') as 'asc' | 'desc'
    );
  }

  onToggleDisabled(checked: boolean): void {
    this.includeDisabled.set(checked);
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadUsers();
  }

  deleteUser(user: User): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete User',
        message: `Are you sure you want to delete "${user.username}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        icon: 'delete',
        color: 'warn',
      },
      width: '420px',
      autoFocus: false,
      panelClass: 'confirm-dialog-panel',
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.usersService.deleteUser(user.id).subscribe({
        next: () => {
          this.snackBar.open('User deleted successfully', 'Close', {
            duration: 3000,
          });
          this.loadUsers();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to delete user',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
        },
      });
    });
  }

  getRolesArray(roles: string | string[] | undefined): string[] {
    if (!roles) {
      return [];
    }
    if (typeof roles === 'string') {
      return roles.split(',').map(r => r.trim()).filter(r => r);
    }
    return Array.isArray(roles) ? roles : [];
  }
}



