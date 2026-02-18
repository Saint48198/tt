# Component Creation Guide - Preventing Build Breaks

## 🚨 Common Issues That Break Builds

### 1. **Missing Type Exports** (Most Common)
When using `isolatedModules: true`, you must export types with `export type`:

❌ **WRONG:**
```typescript
export { SomeClass, SomeInterface } from './file';
```

✅ **CORRECT:**
```typescript
export { SomeClass } from './file';
export type { SomeInterface } from './file';
```

### 2. **Incorrect Import Paths**
Always use the path alias defined in `tsconfig.base.json`:

❌ **WRONG:**
```typescript
import { Something } from '@shared/services/login/login.service';
```

✅ **CORRECT:**
```typescript
import { Something } from '@shared/services';
```

### 3. **Missing Exports in index.ts**
Every new component must be exported from the library's `index.ts`:

❌ **WRONG:** Component created but not exported

✅ **CORRECT:**
```typescript
// shared/components/src/index.ts
export * from './lib/my-new-component/my-new-component.component';
```

### 4. **Missing Type Annotations**
With strict TypeScript settings, all parameters need explicit types:

❌ **WRONG:**
```typescript
subscribe({
  next: (res) => { } // 'res' has implicit 'any' type
})
```

✅ **CORRECT:**
```typescript
subscribe({
  next: (res: MyResponseType) => { }
})
```

### 5. **GeoJSON Type Issues**
When using GeoJSON types, ensure proper type definitions:

❌ **WRONG:**
```typescript
geoJson: GeoJSON.GeoJsonObject; // Too generic, doesn't support 'properties'
```

✅ **CORRECT:**
```typescript
geoJson: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.GeoJsonObject;
```

---

## ✅ Component Creation Checklist

When creating a new component, follow these steps in order:

### Step 1: Create Component Files
```bash
# Use nx generator or create manually
npx nx g @nx/angular:component my-component --project=shared-components --standalone
```

### Step 2: Update index.ts IMMEDIATELY
```typescript
// shared/components/src/index.ts
export * from './lib/my-component/my-component.component';
```

### Step 3: Ensure Proper Type Exports
If your component exports interfaces/types:
```typescript
// my-component.component.ts
export interface MyData {
  id: number;
  name: string;
}

export class MyComponent { }
```

Then update index.ts:
```typescript
// index.ts
export * from './lib/my-component/my-component.component'; // Exports everything
// OR be explicit:
export { MyComponent } from './lib/my-component/my-component.component';
export type { MyData } from './lib/my-component/my-component.component';
```

### Step 4: Add Required Imports
```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-my-component',
  standalone: true,
  imports: [CommonModule], // Don't forget CommonModule for basic directives
  templateUrl: './my-component.component.html',
  styleUrl: './my-component.component.scss',
})
export class MyComponent {
  @Input() data?: MyData;
}
```

### Step 5: Use Proper Template Syntax
Angular 17+ control flow syntax:
```html
<!-- Use @if instead of *ngIf -->
@if (condition) {
  <div>Content</div>
}

<!-- Use @for instead of *ngFor -->
@for (item of items; track item.id) {
  <div>{{ item.name }}</div>
}
```

### Step 6: Import from Shared Libraries Correctly
```typescript
// ✅ CORRECT - Use path aliases
import { MapComponent, MapMarker } from '@shared/components';
import { LoginService } from '@shared/services';
import { User } from '@shared/types';

// ❌ WRONG - Don't use relative paths across libraries
import { MapComponent } from '../../../shared/components/src/lib/map/map.component';
```

### Step 7: Type Observable Subscriptions
```typescript
import { Observable } from 'rxjs';

interface ApiResponse {
  data: string;
}

myService.getData().subscribe({
  next: (response: ApiResponse) => {
    console.log(response.data);
  },
  error: (error: Error) => {
    console.error(error.message);
  }
});
```

### Step 8: Run Build Check
```bash
# Check for errors before committing
npx nx build shared-components
npx nx build frontend-admin
npx nx build frontend-app
```

---

## 🛠️ Quick Fix Template

If you broke the build, here's the checklist to fix it:

### 1. Check TypeScript Errors
```bash
npx nx build <project-name> 2>&1 | grep -A5 "ERROR"
```

### 2. Common Fixes

**Fix 1: Type Export Error**
```bash
# Error: TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'
```
Solution: Change `export { Type }` to `export type { Type }`

**Fix 2: Module Not Found**
```bash
# Error: TS2307: Cannot find module '@shared/services/...'
```
Solution: Import from `@shared/services` not `@shared/services/subfolder`

**Fix 3: Implicit Any Type**
```bash
# Error: TS7006: Parameter 'x' implicitly has an 'any' type
```
Solution: Add explicit type annotation: `(x: SomeType) => {}`

**Fix 4: Object of Type Unknown**
```bash
# Error: TS2571: Object is of type 'unknown'
```
Solution: Check service is properly injected and imported

---

## 📋 Standard Component Template

Use this as a starting point for new components:

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

// Export types separately
export interface MyComponentData {
  id: number;
  title: string;
}

@Component({
  selector: 'lib-my-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-component.component.html',
  styleUrl: './my-component.component.scss',
})
export class MyComponent {
  @Input() data?: MyComponentData;
  @Output() dataChange = new EventEmitter<MyComponentData>();

  handleClick(): void {
    // Implementation
  }
}
```

**Template (my-component.component.html):**
```html
<div class="my-component">
  @if (data) {
    <h3>{{ data.title }}</h3>
  }
</div>
```

**Don't forget index.ts:**
```typescript
// shared/components/src/index.ts
export * from './lib/my-component/my-component.component';
```

---

## 🔧 Shared Library Structure

```
shared/
├── components/          # UI components
│   └── src/
│       ├── index.ts    # ⚠️ Export all components here
│       └── lib/
├── services/           # Business logic services
│   └── src/
│       ├── index.ts    # ⚠️ Export all services here
│       └── lib/
├── types/              # Shared TypeScript types
│   └── src/
│       ├── index.ts    # ⚠️ Export all types here
│       └── lib/
└── util/               # Utility functions
    └── src/
        ├── index.ts    # ⚠️ Export all utils here
        └── lib/
```

**Path Aliases (tsconfig.base.json):**
```json
{
  "paths": {
    "@shared/types": ["shared/types/src/index.ts"],
    "@shared/util": ["shared/util/src/index.ts"],
    "@shared/services": ["shared/services/src/index.ts"],
    "@shared/components": ["shared/components/src/index.ts"]
  }
}
```

---

## 🎯 Pre-Commit Checklist

Before committing new components:

- [ ] Component files created in correct directory
- [ ] Exported from library's `index.ts`
- [ ] All imports use `@shared/*` aliases
- [ ] All types explicitly declared (no implicit `any`)
- [ ] Types exported with `export type` syntax
- [ ] Template uses Angular 17+ syntax (`@if`, `@for`)
- [ ] CommonModule imported if using standard directives
- [ ] Build passes: `npx nx build <library-name>`
- [ ] No ESLint errors
- [ ] HTML template file exists (if using `templateUrl`)
- [ ] SCSS file exists (if using `styleUrl`)

---

## 💡 Pro Tips

1. **Always use nx generators** - They set up the structure correctly:
   ```bash
   npx nx g @nx/angular:component my-component --project=shared-components --standalone
   ```

2. **Test imports immediately** - Don't wait until build time:
   ```typescript
   // In any consuming component, try importing right away:
   import { MyComponent } from '@shared/components';
   ```

3. **Use TypeScript strict mode** - It catches errors early:
   ```json
   "strict": true,
   "noImplicitAny": true
   ```

4. **Export types properly** - Remember the `isolatedModules` setting requires `export type`:
   ```typescript
   export type { MyInterface, MyType };
   export { MyClass, MyEnum };
   ```

5. **Run incremental builds** - Check as you go:
   ```bash
   npx nx build shared-components --watch
   ```

---

## 🚀 Automation Script

Create a script to automate the checklist:

```bash
#!/bin/bash
# create-component.sh

COMPONENT_NAME=$1
PROJECT=$2

if [ -z "$COMPONENT_NAME" ] || [ -z "$PROJECT" ]; then
  echo "Usage: ./create-component.sh <component-name> <project>"
  echo "Example: ./create-component.sh my-widget shared-components"
  exit 1
fi

# Generate component
npx nx g @nx/angular:component $COMPONENT_NAME --project=$PROJECT --standalone

# Add export to index.ts
INDEX_FILE="${PROJECT//-/\/}/src/index.ts"
echo "export * from './lib/$COMPONENT_NAME/$COMPONENT_NAME.component';" >> $INDEX_FILE

# Build to check for errors
npx nx build $PROJECT

echo "✅ Component created and exported!"
echo "📝 Remember to:"
echo "   1. Add type exports if needed"
echo "   2. Import CommonModule if using directives"
echo "   3. Use @shared/* path aliases for imports"
```

---

## 📚 Additional Resources

- [Angular Standalone Components](https://angular.io/guide/standalone-components)
- [TypeScript isolatedModules](https://www.typescriptlang.org/tsconfig#isolatedModules)
- [Nx Workspace Structure](https://nx.dev/concepts/more-concepts/library-types)

---

## Summary

The key to preventing build breaks:

1. ✅ Export from `index.ts` immediately
2. ✅ Use `export type` for interfaces/types
3. ✅ Import from `@shared/*` aliases only
4. ✅ Add explicit type annotations
5. ✅ Test build after each component creation

**Remember:** The build breaks because of TypeScript's strict mode and `isolatedModules` setting, which are GOOD things - they catch errors early!

