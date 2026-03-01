import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginService, LoginResponse } from '@shared/services';

@Component({
  selector: 'lib-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private loginService = inject(LoginService);
  private router = inject(Router);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  errorMessage = signal<string | null>(null);
  loading = signal(false);

  submit() {
    if (this.form.invalid) {
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const { username, password } = this.form.value;

    if (typeof username !== 'string' || typeof password !== 'string') {
      this.errorMessage.set('Invalid input');
      this.loading.set(false);
      return;
    }

    this.loginService.login(username, password).subscribe({
      next: (res: LoginResponse) => {
        this.loading.set(false);

        // Optionally store token
        localStorage.setItem('auth_token', res.token);

        this.router.navigate(['/']);
      },
      error: (error: Error) => {
        this.loading.set(false);
        this.errorMessage.set(error.message);
      },
    });
  }
}
