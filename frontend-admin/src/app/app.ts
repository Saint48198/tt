import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent, FooterComponent } from '@shared/components';
import { AuthService } from '@shared/services';

@Component({
  standalone: true,
  imports: [RouterModule, CommonModule, HeaderComponent, FooterComponent],
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
    { label: 'Countries', path: '/countries' },
    { label: 'States', path: '/states' },
    { label: 'Cities', path: '/cities' },
    { label: 'Attractions', path: '/attractions' },
    { label: 'Trips', path: '/trips' },
    { label: 'Photos', path: '/photos' },
  ];
}
