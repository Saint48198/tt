import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MapComponent, MapMarker } from '@shared/components';

interface PublicCountry {
  country: string;
  lat: number;
  lng: number;
  lastVisited: string | null;
}

interface PublicProfile {
  username: string;
  countries: PublicCountry[];
}

@Component({
  selector: 'app-profile-map',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './profile-map.component.html',
  styleUrl: './profile-map.component.scss',
})
export class ProfileMapComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  username = signal('');
  profile = signal<PublicProfile | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly mapCenter: [number, number] = [20, 0];
  readonly mapZoom = 3;

  markers = computed<MapMarker[]>(() => {
    const p = this.profile();
    if (!p) return [];
    return p.countries.map((c) => ({
      lat: c.lat,
      lng: c.lng,
      title: c.country,
      popup: `
        <div style="text-align: center; min-width: 120px;">
          <strong style="font-size: 1.1em;">${c.country}</strong>
          ${c.lastVisited ? `<br/><span style="color: #666;display:inline-flex;align-items:center;gap:3px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="12" height="12"><circle cx="16" cy="16" r="16" fill="#1f2937"/><path d="M10 8v2H8v14h16V10h-2V8h-2v2h-8V8h-2zm-1 6h14v8H9v-8zm3 2v2h2v-2h-2zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2h-2zm4 0v2h2v-2h-2z" fill="#fff"/></svg> ${new Date(c.lastVisited).toLocaleDateString()}</span>` : ''}
        </div>
      `,
    }));
  });

  hasMarkers = computed(() => this.markers().length > 0);

  ngOnInit(): void {
    const name = this.route.parent?.snapshot.paramMap.get('username')
      ?? this.route.snapshot.paramMap.get('username')
      ?? '';
    this.username.set(name);
    this.loadProfile(name);
  }

  private loadProfile(username: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<PublicProfile>(`/api/public/profile/${encodeURIComponent(username)}`).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: (err) => {
        if (err.status === 404) {
          this.error.set('User not found');
        } else {
          this.error.set('Failed to load profile');
        }
        this.loading.set(false);
      },
    });
  }
}


