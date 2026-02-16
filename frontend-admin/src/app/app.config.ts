import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    ErrorHandler,
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
  ],
};
