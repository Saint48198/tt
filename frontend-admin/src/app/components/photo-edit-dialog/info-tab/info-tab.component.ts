import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { PhotoEditStateService } from '../photo-edit-state.service';

@Component({
  selector: 'app-info-tab',
  imports: [DatePipe, MatIconModule, MatDividerModule],
  templateUrl: './info-tab.component.html',
  styleUrl: './info-tab.component.scss',
})
export class InfoTabComponent {
  readonly state = inject(PhotoEditStateService);
}
