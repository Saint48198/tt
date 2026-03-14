import {
  Component,
  input,
  output,
  signal,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  HostListener,
  effect,
} from '@angular/core';
import { LightboxPhoto } from './lightbox.types';

@Component({
  selector: 'lib-lightbox',
  templateUrl: './lightbox.component.html',
  styleUrl: './lightbox.component.scss',
})
export class LightboxComponent implements AfterViewChecked {
  @ViewChild('lightboxDialog') lightboxDialogRef?: ElementRef<HTMLElement>;

  /** The list of photos to display */
  photos = input.required<LightboxPhoto[]>();

  /** Whether the lightbox is open */
  open = input.required<boolean>();

  /** The index of the currently displayed photo */
  currentIndex = input<number>(0);

  /** Emitted when the lightbox should close */
  closed = output<void>();

  /** Emitted when the index changes (navigation) */
  indexChange = output<number>();

  readonly imageLoading = signal(true);
  readonly imageSize = signal<{ width: number; height: number } | null>(null);

  private needsFocus = false;
  private triggerEl: HTMLElement | null = null;

  constructor() {
    // Preload adjacent images whenever the index changes
    effect(() => {
      const idx = this.currentIndex();
      const all = this.photos();
      if (this.open() && all.length > 1) {
        this.preloadAdjacent(idx, all);
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.needsFocus && this.lightboxDialogRef) {
      this.lightboxDialogRef.nativeElement.focus();
      this.needsFocus = false;
    }
  }

  /** Call this before opening to store the trigger element for focus restore */
  saveTrigger(): void {
    this.triggerEl = document.activeElement as HTMLElement | null;
    this.needsFocus = true;
    this.imageLoading.set(true);
  }

  onOverlayClick(): void {
    this.close();
  }

  onContentClick(event: Event): void {
    event.stopPropagation();
  }

  onContentKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    this.onKeydown(event);
  }

  close(): void {
    this.closed.emit();
    if (this.triggerEl) {
      setTimeout(() => this.triggerEl?.focus());
      this.triggerEl = null;
    }
  }

  prev(): void {
    const total = this.photos().length;
    if (total === 0) return;
    const newIdx = (this.currentIndex() - 1 + total) % total;
    this.navigate(newIdx);
  }

  next(): void {
    const total = this.photos().length;
    if (total === 0) return;
    const newIdx = (this.currentIndex() + 1) % total;
    this.navigate(newIdx);
  }

  navigate(newIndex: number): void {
    if (newIndex === this.currentIndex()) return;
    this.imageLoading.set(true);
    this.indexChange.emit(newIndex);
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const maxW = window.innerWidth * 0.85;
    const maxH = window.innerHeight * 0.78;
    const scale = Math.min(1, maxW / natW, maxH / natH);

    this.imageSize.set({
      width: Math.round(natW * scale),
      height: Math.round(natH * scale),
    });
    this.imageLoading.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.close();
        event.preventDefault();
        break;
      case 'ArrowLeft':
        this.prev();
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.next();
        event.preventDefault();
        break;
      case 'Home':
        this.navigate(0);
        event.preventDefault();
        break;
      case 'End':
        this.navigate(Math.max(0, this.photos().length - 1));
        event.preventDefault();
        break;
      case 'Tab':
        this.trapFocus(event);
        break;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    // Skip if the event originated inside the dialog (already handled by template bindings)
    const dialog = this.lightboxDialogRef?.nativeElement;
    if (dialog && dialog.contains(event.target as Node)) return;
    this.onKeydown(event);
  }

  private trapFocus(event: KeyboardEvent): void {
    const dialog = this.lightboxDialogRef?.nativeElement;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first || document.activeElement === dialog) {
        last.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }

  private preloadAdjacent(currentIndex: number, all: LightboxPhoto[]): void {
    const total = all.length;
    if (total <= 1) return;
    const indices = [(currentIndex + 1) % total, (currentIndex - 1 + total) % total];
    for (const i of indices) {
      const img = new Image();
      img.src = all[i].url;
    }
  }
}
