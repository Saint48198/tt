# 🛠️ Build System & Component Creation

## The Problem

When creating new Angular components in this Nx monorepo, the build can break due to:

1. **Missing exports** in library `index.ts` files
2. **Type export errors** with TypeScript's `isolatedModules` setting
3. **Invalid import paths** (using relative paths instead of aliases)
4. **Missing type annotations** causing implicit `any` errors
5. **Missing Angular imports** (e.g., `CommonModule`)

## The Solution

We've created automated tools and guidelines to prevent these issues.

---

## 🚀 Quick Start: Creating a New Component

### Option 1: Use the Automated Script (Recommended)

```bash
# Create a new component with auto-validation
./create-component.sh my-component shared-components

# Or for frontend projects
./create-component.sh my-feature frontend-admin
```

This script will:

- ✅ Generate the component using Nx
- ✅ Automatically add exports to `index.ts`
- ✅ Build the project to validate
- ✅ Show you next steps

### Option 2: Manual Creation (Advanced)

```bash
# Generate component
npx nx g @nx/angular:component my-component --project=shared-components --standalone

# Add export to index.ts
echo "export * from './lib/my-component/my-component.component';" >> shared/components/src/index.ts

# Validate build
npx nx build shared-components
```

---

## ✅ Pre-Commit Validation

Before committing, run the validation script:

```bash
./validate-build.sh
```

This checks for:

- Missing exports in library index files
- Invalid cross-library imports
- TypeScript compilation errors
- ESLint violations

---

## 📚 Documentation

### Essential Reading

1. **[COMPONENT_CREATION_GUIDE.md](./COMPONENT_CREATION_GUIDE.md)** - Complete guide to preventing build breaks
2. **[MAP_COMPONENT_SUMMARY.md](./MAP_COMPONENT_SUMMARY.md)** - Example of a properly created component

### Quick Reference

#### Common Build Errors and Fixes

| Error                                                           | Fix                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `TS1205: Re-exporting a type when 'isolatedModules' is enabled` | Use `export type { MyType }` instead of `export { MyType }`     |
| `TS2307: Cannot find module '@shared/...'`                      | Import from `@shared/services` not `@shared/services/subfolder` |
| `TS7006: Parameter 'x' implicitly has an 'any' type`            | Add explicit type: `(x: SomeType) => {}`                        |
| `TS2571: Object is of type 'unknown'`                           | Check service is imported and injected correctly                |

#### Path Aliases (Always Use These!)

```typescript
// ✅ CORRECT
import { MapComponent } from '@shared/components';
import { LoginService } from '@shared/services';
import { User } from '@shared/types';
import { formatDate } from '@shared/util';

// ❌ WRONG - Never use relative paths across libraries
import { MapComponent } from '../../../shared/components/src/lib/map/map.component';
```

#### Export Pattern

```typescript
// shared/components/src/index.ts

// Export everything (classes, components, interfaces)
export * from './lib/my-component/my-component.component';

// OR be explicit
export { MyComponent } from './lib/my-component/my-component.component';
export type { MyComponentData, MyComponentConfig } from './lib/my-component/my-component.component';
```

#### Component Template

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MyComponentData {
  id: number;
  title: string;
}

@Component({
  selector: 'lib-my-component',
  standalone: true,
  imports: [CommonModule], // Required for @if, @for, etc.
  templateUrl: './my-component.component.html',
  styleUrl: './my-component.component.scss',
})
export class MyComponent {
  @Input() data?: MyComponentData;
  @Output() itemClick = new EventEmitter<number>();

  handleClick(id: number): void {
    this.itemClick.emit(id);
  }
}
```

---

## 🔧 Project Structure

```
tt/
├── shared/
│   ├── components/          # Reusable UI components
│   │   └── src/
│   │       ├── index.ts     # ⚠️ MUST export all components
│   │       └── lib/
│   ├── services/            # Business logic
│   │   └── src/
│   │       ├── index.ts     # ⚠️ MUST export all services
│   │       └── lib/
│   ├── types/               # TypeScript interfaces/types
│   │   └── src/
│   │       ├── index.ts     # ⚠️ MUST export all types
│   │       └── lib/
│   ���── util/                # Helper functions
│       └── src/
│           ├── index.ts     # ⚠️ MUST export all utilities
│           └── lib/
├── frontend-app/            # User-facing application
├── frontend-admin/          # Admin dashboard
└── api/                     # Express backend
```

---

## 📋 Checklists

### Creating a Shared Component

- [ ] Run `./create-component.sh <name> shared-components`
- [ ] Edit component files
- [ ] Add type exports to `index.ts` if needed (use `export type`)
- [ ] Import CommonModule if using directives
- [ ] Use `@shared/*` for cross-library imports
- [ ] Test: `npx nx build shared-components`
- [ ] Run `./validate-build.sh`

### Creating a Feature Component (Frontend)

- [ ] Run `./create-component.sh <name> frontend-admin` (or `frontend-app`)
- [ ] Edit component files
- [ ] Import from `@shared/*` for shared resources
- [ ] Add explicit types for all parameters
- [ ] Test: `npx nx serve frontend-admin`

### Before Committing

- [ ] Run `./validate-build.sh`
- [ ] Check all TypeScript errors are fixed
- [ ] Ensure all tests pass: `npx nx test <project>`
- [ ] Review changes: `git diff`

---

## 🎯 Best Practices

### 1. Always Use the Path Aliases

```typescript
// DO THIS ✅
import { MapComponent, MapMarker } from '@shared/components';

// NOT THIS ❌
import { MapComponent } from '../../../shared/components/src/lib/map/map.component';
```

### 2. Export Types Properly

```typescript
// In shared/services/src/index.ts

// ✅ Correct way with isolatedModules
export { AuthService } from './lib/auth/auth.service';
export type { LoginResponse, UserPayload } from './lib/auth/auth.service';
```

### 3. Import CommonModule for Template Syntax

```typescript
@Component({
  // ...
  imports: [CommonModule], // Needed for @if, @for, async pipe, etc.
})
```

### 4. Type All Subscriptions

```typescript
// ✅ Correct
this.service.getData().subscribe({
  next: (data: MyDataType) => {},
  error: (error: Error) => {},
});

// ❌ Wrong - implicit 'any'
this.service.getData().subscribe({
  next: (data) => {},
  error: (error) => {},
});
```

### 5. Use Angular 17+ Template Syntax

```html
<!-- ✅ New syntax -->
@if (condition) {
<div>Content</div>
} @for (item of items; track item.id) {
<div>{{ item.name }}</div>
}

<!-- ❌ Old syntax (still works but discouraged) -->
<div *ngIf="condition">Content</div>
<div *ngFor="let item of items; trackBy: trackById">{{ item.name }}</div>
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't: Create component without adding to index.ts

```bash
npx nx g component my-component --project=shared-components
# Oops! Forgot to export it
```

### ✅ Do: Use the automated script

```bash
./create-component.sh my-component shared-components
# Automatically exports and validates
```

---

### ❌ Don't: Use relative imports across libraries

```typescript
import { SomeService } from '../../../shared/services/src/lib/some.service';
```

### ✅ Do: Use path aliases

```typescript
import { SomeService } from '@shared/services';
```

---

### ❌ Don't: Export types with regular export

```typescript
export { MyInterface, MyType } from './file';
// Error: TS1205: Re-exporting a type...
```

### ✅ Do: Use export type

```typescript
export type { MyInterface, MyType } from './file';
```

---

## 🔍 Debugging Build Issues

### Step 1: Identify the Error

```bash
npx nx build <project-name>
```

Look for:

- `TS1205` - Type export issue
- `TS2307` - Module not found
- `TS7006` - Implicit any type
- `TS2571` - Object is unknown

### Step 2: Apply the Fix

See [COMPONENT_CREATION_GUIDE.md](./COMPONENT_CREATION_GUIDE.md) for detailed fixes.

### Step 3: Validate

```bash
./validate-build.sh
```

---

## 🎓 Learning Resources

- [Component Creation Guide](./COMPONENT_CREATION_GUIDE.md) - Comprehensive guide
- [Map Component Example](./MAP_COMPONENT_SUMMARY.md) - Real-world example
- [Nx Documentation](https://nx.dev) - Workspace management
- [Angular Standalone Components](https://angular.io/guide/standalone-components) - Modern Angular

---

## 💡 Pro Tips

1. **Use the scripts** - They automate best practices
2. **Build incrementally** - Don't create 5 components then build
3. **Check the logs** - Read error messages carefully
4. **Follow the checklist** - It's there for a reason
5. **Export immediately** - Add to index.ts right after creation

---

## 🆘 Getting Help

If you encounter issues:

1. Check [COMPONENT_CREATION_GUIDE.md](./COMPONENT_CREATION_GUIDE.md)
2. Run `./validate-build.sh` to see what's wrong
3. Look at existing components for examples (e.g., MapComponent)
4. Check the error patterns in the guide

---

## Summary

**To prevent build breaks when creating components:**

1. ✅ Use `./create-component.sh` script
2. ✅ Always export from library `index.ts`
3. ✅ Use `@shared/*` path aliases
4. ✅ Add explicit type annotations
5. ✅ Run `./validate-build.sh` before committing

**The scripts handle most of this automatically!**
