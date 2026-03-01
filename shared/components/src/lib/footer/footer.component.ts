import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-footer',
  imports: [RouterModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  @Input() showLinks = true;
  @Input() links: { label: string; path: string }[] = [
    { label: 'About', path: '/about' },
    { label: 'Privacy', path: '/privacy' },
    { label: 'Terms', path: '/terms' },
    { label: 'Contact', path: '/contact' },
  ];

  currentYear = new Date().getFullYear();
}
