import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '@shared/services';

@Component({
  selector: 'lib-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Input() title = 'Trip Tracker';
  @Input() showNav = true;
  @Input() navLinks: { label: string; path: string }[] = [
    { label: 'Home', path: '/' },
    { label: 'Explore', path: '/explore' },
    { label: 'My Trips', path: '/trips' },
  ];

  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser$ = this.authService.currentUser$;
  showUserMenu = signal(false);

  toggleUserMenu(): void {
    this.showUserMenu.update((value) => !value);
  }

  closeUserMenu(): void {
    this.showUserMenu.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
