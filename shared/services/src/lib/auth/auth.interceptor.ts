import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * HTTP interceptor that adds withCredentials to all API requests
 * so the auth_token HttpOnly cookie is sent with every request,
 * and also attaches the Authorization: Bearer header from localStorage
 * so the email/user identity is included in every API call.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.url.startsWith('/api')) {
      const token = localStorage.getItem('auth_token');
      const authReq = req.clone({
        withCredentials: true,
        ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
      });
      return next.handle(authReq);
    }
    return next.handle(req);
  }
}
