#!/bin/bash

# Component Creator with Auto-Validation
# Usage: ./create-component.sh <component-name> <project>
# Example: ./create-component.sh my-widget shared-components

set -e  # Exit on error

COMPONENT_NAME=$1
PROJECT=$2

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate arguments
if [ -z "$COMPONENT_NAME" ] || [ -z "$PROJECT" ]; then
  echo -e "${RED}❌ Error: Missing arguments${NC}"
  echo "Usage: ./create-component.sh <component-name> <project>"
  echo ""
  echo "Available projects:"
  echo "  - shared-components"
  echo "  - frontend-app"
  echo "  - frontend-admin"
  echo ""
  echo "Example: ./create-component.sh my-widget shared-components"
  exit 1
fi

# Validate project name
VALID_PROJECTS=("shared-components" "frontend-app" "frontend-admin")
if [[ ! " ${VALID_PROJECTS[@]} " =~ " ${PROJECT} " ]]; then
  echo -e "${RED}❌ Error: Invalid project name${NC}"
  echo "Valid projects: ${VALID_PROJECTS[@]}"
  exit 1
fi

echo -e "${YELLOW}🔨 Creating component '${COMPONENT_NAME}' in '${PROJECT}'...${NC}"
echo ""

# Step 1: Generate component using nx
echo "📦 Generating component files..."
npx nx g @nx/angular:component $COMPONENT_NAME --project=$PROJECT --standalone --dry-run=false

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to generate component${NC}"
  exit 1
fi

# Step 2: Add export to index.ts (only for shared libraries)
if [[ "$PROJECT" == "shared-components" ]] || [[ "$PROJECT" == "shared-services" ]] || [[ "$PROJECT" == "shared-types" ]]; then
  INDEX_FILE="shared/${PROJECT#shared-}/src/index.ts"

  if [ -f "$INDEX_FILE" ]; then
    echo "📝 Adding export to $INDEX_FILE..."
    EXPORT_LINE="export * from './lib/$COMPONENT_NAME/$COMPONENT_NAME.component';"

    # Check if export already exists
    if grep -q "$EXPORT_LINE" "$INDEX_FILE"; then
      echo -e "${YELLOW}⚠️  Export already exists in index.ts${NC}"
    else
      echo "$EXPORT_LINE" >> "$INDEX_FILE"
      echo -e "${GREEN}✅ Export added to index.ts${NC}"
    fi
  else
    echo -e "${RED}❌ Warning: Could not find $INDEX_FILE${NC}"
  fi
fi

# Step 3: Build the project to validate
echo ""
echo "🏗️  Building $PROJECT to validate..."
npx nx build $PROJECT

if [ $? -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ Build failed! Please fix the errors above.${NC}"
  exit 1
fi

# Success!
echo ""
echo -e "${GREEN}✅ Component created successfully!${NC}"
echo ""
echo "📁 Component location:"
if [[ "$PROJECT" == "shared-components" ]]; then
  echo "   shared/components/src/lib/$COMPONENT_NAME/$COMPONENT_NAME.component.ts"
elif [[ "$PROJECT" == "frontend-app" ]]; then
  echo "   frontend-app/src/app/$COMPONENT_NAME/$COMPONENT_NAME.component.ts"
elif [[ "$PROJECT" == "frontend-admin" ]]; then
  echo "   frontend-admin/src/app/$COMPONENT_NAME/$COMPONENT_NAME.component.ts"
fi
echo ""
echo "📝 Next steps:"
echo "   1. Edit the component files"
echo "   2. Add any needed type exports to index.ts using 'export type'"
echo "   3. Import CommonModule if using standard directives (@if, @for)"
echo "   4. Use @shared/* path aliases for cross-library imports"
echo ""
echo "💡 Import in other components:"
if [[ "$PROJECT" == "shared-components" ]]; then
  echo "   import { ${COMPONENT_NAME^}Component } from '@shared/components';"
else
  echo "   import { ${COMPONENT_NAME^}Component } from './$COMPONENT_NAME/$COMPONENT_NAME.component';"
fi
echo ""
echo "📖 See COMPONENT_CREATION_GUIDE.md for best practices"

