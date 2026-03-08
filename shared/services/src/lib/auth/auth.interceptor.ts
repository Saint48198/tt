import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * HTTP interceptor that adds withCredentials to all API requests
 * so the auth_token HttpOnly cookie is sent with every request.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.url.startsWith('/api')) {
      const authReq = req.clone({ withCredentials: true });
      return next.handle(authReq);
    }
    return next.handle(req);
  }
}
