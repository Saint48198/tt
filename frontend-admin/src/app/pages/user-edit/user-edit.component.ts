import { Component, OnInit, inject, signal, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HasUnsavedChanges } from '@shared/services';
import { UsersService } from '../../services/users.service';
import { User } from '../../interfaces';

@Component({
  selector: 'app-user-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './user-edit.component.html',
  styleUrl: './user-edit.component.scss',
})
export class UserEditComponent implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  form!: FormGroup;
  passwordForm!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);
  saving = signal(false);
  savingPassword = signal(false);
  uploadingAvatar = signal(false);
  userId: number | null = null;
  user = signal<User | null>(null);
  showPasswordSection = signal(false);
  profileIconPreview = signal<string | null>(null);
  private saved = false;

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    if (this.saved) return false;
    return this.form?.dirty ?? false;
  }

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.userId = +id;
      this.loadUser(this.userId);
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: [''],
      instagram: ['', [Validators.maxLength(255)]],
      portfolio_url: ['', [Validators.maxLength(1000)]],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(12)]],
      confirmNewPassword: ['', [Validators.required]],
    });
  }

  private loadUser(id: number): void {
    this.loading.set(true);
    this.usersService.getUser(id).subscribe({
      next: (user: User) => {
        this.user.set(user);
        this.form.patchValue({
          username: user.username,
          email: user.email,
          instagram: user.instagram || '',
          portfolio_url: user.portfolio_url || '',
        });
        this.profileIconPreview.set(user.profile_icon || null);
        // Remove password validator in edit mode
        this.form.get('password')?.clearValidators();
        this.form.get('password')?.updateValueAndValidity();
        this.loading.set(false);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to load user',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.loading.set(false);
        this.router.navigate(['/users']);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formValue = this.form.value;

    if (this.isEditMode() && this.userId) {
      const payload: { email?: string; instagram?: string | null; portfolio_url?: string | null } = {};
      if (formValue.email) payload.email = formValue.email;
      payload.instagram = formValue.instagram?.trim() || null;
      payload.portfolio_url = formValue.portfolio_url?.trim() || null;

      this.usersService.updateUser(this.userId, payload).subscribe({
        next: () => {
          this.saved = true;
          this.snackBar.open('User updated successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/users']);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to update user',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
          this.saving.set(false);
        },
      });
    } else {
      const createPayload = {
        username: formValue.username,
        email: formValue.email,
        password: formValue.password,
      };

      if (!createPayload.password) {
        this.form.get('password')?.setErrors({ required: true });
        this.form.get('password')?.markAsTouched();
        this.saving.set(false);
        return;
      }

      this.usersService.createUser(createPayload).subscribe({
        next: () => {
          this.saved = true;
          this.snackBar.open('User created successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/users']);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to create user',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
          this.saving.set(false);
        },
      });
    }
  }

  triggerAvatarUpload(): void {
    this.avatarInput?.nativeElement?.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file', 'Close', { duration: 3000 });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.snackBar.open('Image must be smaller than 5MB', 'Close', { duration: 3000 });
      return;
    }

    if (!this.userId) {
      // For new users, show local preview (avatar will be uploaded after creation)
      const reader = new FileReader();
      reader.onload = () => {
        this.profileIconPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
      return;
    }

    this.uploadingAvatar.set(true);
    this.usersService.uploadAvatar(this.userId, file).subscribe({
      next: (res) => {
        this.profileIconPreview.set(res.profile_icon);
        this.snackBar.open('Profile icon updated', 'Close', { duration: 3000 });
        this.uploadingAvatar.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.snackBar.open(
          err?.error?.error || 'Failed to upload avatar',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.uploadingAvatar.set(false);
      },
    });

    // Reset the input so the same file can be re-selected
    input.value = '';
  }

  removeAvatar(): void {
    if (!this.userId) {
      this.profileIconPreview.set(null);
      return;
    }

    this.uploadingAvatar.set(true);
    this.usersService.removeAvatar(this.userId).subscribe({
      next: () => {
        this.profileIconPreview.set(null);
        this.snackBar.open('Profile icon removed', 'Close', { duration: 3000 });
        this.uploadingAvatar.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.snackBar.open(
          err?.error?.error || 'Failed to remove avatar',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.uploadingAvatar.set(false);
      },
    });
  }

  togglePasswordSection(): void {
    this.showPasswordSection.update((v) => !v);
    if (!this.showPasswordSection()) {
      this.passwordForm.reset();
    }
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmNewPassword } = this.passwordForm.value;

    if (newPassword !== confirmNewPassword) {
      this.passwordForm.get('confirmNewPassword')?.setErrors({ mismatch: true });
      return;
    }

    if (!this.userId) return;

    this.savingPassword.set(true);
    this.usersService.changePassword(this.userId, currentPassword, newPassword).subscribe({
      next: () => {
        this.snackBar.open('Password changed successfully', 'Close', {
          duration: 3000,
        });
        this.passwordForm.reset();
        this.showPasswordSection.set(false);
        this.savingPassword.set(false);
      },
      error: (err: { error?: { message?: string; error?: string } }) => {
        this.snackBar.open(
          err?.error?.message || err?.error?.error || 'Failed to change password',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.savingPassword.set(false);
      },
    });
  }

  getRolesArray(): string[] {
    const user = this.user();
    if (!user?.roles) return [];
    if (typeof user.roles === 'string') {
      return user.roles
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r);
    }
    return Array.isArray(user.roles) ? user.roles : [];
  }
}

