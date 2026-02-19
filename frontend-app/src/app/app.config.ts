import {
  ApplicationConfig,
  ErrorHandler,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    ErrorHandler,
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
  ],
};
