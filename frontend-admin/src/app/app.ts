import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '@shared/components';
import { AuthService } from '@shared/services';

@Component({
  standalone: true,
  imports: [RouterModule, CommonModule, HeaderComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'Trip Tracker Admin';
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser$ = this.authService.currentUser$;

  navLinks = [
    { label: 'Dashboard', path: '/' },
    { label: 'Users', path: '/users' },
    { label: 'Countries', path: '/countries' },
    { label: 'States', path: '/states' },
  ];
}
