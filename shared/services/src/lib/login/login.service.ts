// shared/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';

export interface LoginResponse {
  message: string;
  token: string;
}

export interface UserPayload {
  id: number;
  username: string;
  email: string;
  roles: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);
  private apiUrl = '/api'; // Configure based on environment
  private currentUserSubject = new BehaviorSubject<UserPayload | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadUserFromToken();
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/login`,
        { username, password },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          if (response.token) {
            localStorage.setItem('auth_token', response.token);
            this.decodeAndSetUser(response.token);
          }
        }),
      );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.currentUserSubject.value;
    return user?.roles?.includes(role) ?? false;
  }

  private loadUserFromToken(): void {
    const token = this.getToken();
    if (token) {
      this.decodeAndSetUser(token);
    }
  }

  private decodeAndSetUser(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as UserPayload;
      this.currentUserSubject.next(payload);
    } catch {
      this.logout();
    }
  }
}
