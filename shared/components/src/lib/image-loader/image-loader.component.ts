import { Component, input, signal, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'lib-image-loader',
  standalone: true,
  host: {
    '[class.cover-mode]': 'cover()',
  },
  template: `
    <div class="image-loader-wrapper" [style.border-radius]="borderRadius()">
      @if (!loaded() && !errored()) {
        <div class="image-skeleton" [style.border-radius]="borderRadius()">
          <div class="shimmer"></div>
          <div class="skeleton-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        </div>
      }
      <img
        [src]="src()"
        [alt]="alt()"
        [class]="imgClass()"
        [class.img-loaded]="loaded()"
        [attr.loading]="lazy() ? 'lazy' : null"
        (load)="onLoad()"
        (error)="onError()"
      />
      @if (errored()) {
        <div class="image-error" [style.border-radius]="borderRadius()">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        line-height: 0;
      }

      :host.cover-mode {
        width: 100%;
        height: 100%;
      }

      :host.cover-mode .image-loader-wrapper {
        height: 100%;
      }

      :host.cover-mode img {
        height: 100%;
        object-fit: cover;
      }

      .image-loader-wrapper {
        position: relative;
        overflow: hidden;
        background: var(--mat-sys-surface-container-low, #f3f0f4);
      }

      .image-skeleton {
        position: absolute;
        inset: 0;
        min-height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--mat-sys-surface-container, #eae7ec);
        z-index: 2;
      }

      .skeleton-icon {
        color: var(--mat-sys-outline-variant, #c9c5ca);
        opacity: 0.6;
        z-index: 1;
      }

      .shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.4) 50%,
          transparent 100%
        );
        animation: shimmer 1.5s infinite;
      }

      @keyframes shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      img {
        width: 100%;
        display: block;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      img.img-loaded {
        opacity: 1;
      }

      .image-error {
        min-height: 120px;
        aspect-ratio: 4 / 3;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--mat-sys-error-container, #ffdad6);
        color: var(--mat-sys-on-error-container, #410002);
      }
    `,
  ],
})
export class ImageLoaderComponent implements OnChanges {
  src = input.required<string>();
  alt = input<string>('');
  imgClass = input<string>('');
  borderRadius = input<string>('0');
  lazy = input<boolean>(false);
  /** When true, the image fills its parent container using object-fit: cover */
  cover = input<boolean>(false);

  loaded = signal(false);
  errored = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) {
      this.loaded.set(false);
      this.errored.set(false);
    }
  }

  onLoad(): void {
    this.loaded.set(true);
    this.errored.set(false);
  }

  onError(): void {
    this.errored.set(true);
  }
}
