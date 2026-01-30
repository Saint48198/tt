import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private http = inject(HttpClient);
  private readonly loginUrl = '/api/login';

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(this.loginUrl, payload, { withCredentials: true })
      .pipe(
        map((res) => res),
        catchError(this.handleError),
      );
  }

  private handleError(err: HttpErrorResponse) {
    let errorMessage = 'Login failed';

    if (err.error && typeof err.error === 'object' && 'error' in err.error) {
      errorMessage = (err.error as any).error;
    } else if (err.status === 0) {
      errorMessage = 'Network error';
    } else if (err.status >= 500) {
      errorMessage = 'Server error';
    }

    return throwError(() => new Error(errorMessage));
  }
}
