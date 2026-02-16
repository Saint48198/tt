import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent, FooterComponent } from '@shared/components';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {}

