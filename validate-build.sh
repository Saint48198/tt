#!/bin/bash

# Pre-commit validation script
# Checks for common build-breaking issues before committing

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

echo -e "${YELLOW}🔍 Running pre-commit validation...${NC}"
echo ""

# Check 1: Verify all exports in index.ts files
echo "📋 Checking library exports..."

check_exports() {
  local LIB_PATH=$1
  local LIB_NAME=$2

  if [ -d "$LIB_PATH/src/lib" ]; then
    # Find all component files
    COMPONENT_FILES=$(find "$LIB_PATH/src/lib" -name "*.component.ts" -type f)

    for COMP_FILE in $COMPONENT_FILES; do
      # Extract component path relative to lib/
      REL_PATH=$(echo "$COMP_FILE" | sed "s|$LIB_PATH/src/lib/||" | sed 's|\.ts$||')

      # Check if it's exported in index.ts
      if ! grep -q "from './lib/$REL_PATH'" "$LIB_PATH/src/index.ts" 2>/dev/null; then
        echo -e "${RED}   ❌ Missing export: $REL_PATH in $LIB_NAME/src/index.ts${NC}"
        ERRORS=$((ERRORS + 1))
      fi
    done
  fi
}

check_exports "shared/components" "shared/components"
check_exports "shared/services" "shared/services"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}   ✅ All components are exported${NC}"
fi

# Check 2: Verify no relative imports across libraries
echo ""
echo "📋 Checking for invalid cross-library imports..."

INVALID_IMPORTS=$(grep -r "from '\.\./\.\./\.\./shared" frontend-*/src --include="*.ts" 2>/dev/null || true)

if [ ! -z "$INVALID_IMPORTS" ]; then
  echo -e "${RED}   ❌ Found relative imports across libraries:${NC}"
  echo "$INVALID_IMPORTS" | while read -r line; do
    echo -e "${RED}      $line${NC}"
  done
  echo -e "${YELLOW}   💡 Use @shared/* path aliases instead${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}   ✅ No invalid cross-library imports${NC}"
fi

# Check 3: Verify TypeScript compilation (quick check - frontend only)
echo ""
echo "📋 Running TypeScript checks..."

# Check frontend projects only (API uses different module system)
FRONTEND_PROJECTS=("frontend-app/tsconfig.app.json" "frontend-admin/tsconfig.app.json")
TS_ERRORS=0

for TSCONFIG in "${FRONTEND_PROJECTS[@]}"; do
  if [ -f "$TSCONFIG" ]; then
    PROJECT_NAME=$(dirname "$TSCONFIG")
    if npx tsc --noEmit -p "$TSCONFIG" 2>&1 | grep -q "error TS"; then
      echo -e "${RED}   ❌ TypeScript errors in $PROJECT_NAME${NC}"
      npx tsc --noEmit -p "$TSCONFIG" 2>&1 | grep "error TS" | head -3
      TS_ERRORS=1
    fi
  fi
done

if [ $TS_ERRORS -eq 0 ]; then
  echo -e "${GREEN}   ✅ No TypeScript errors in frontend projects${NC}"
else
  ERRORS=$((ERRORS + 1))
fi

# Check 4: Run ESLint on changed files
echo ""
echo "📋 Running ESLint checks..."

CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ ! -z "$CHANGED_FILES" ]; then
  for FILE in $CHANGED_FILES; do
    if [ -f "$FILE" ]; then
      if ! npx eslint "$FILE" --quiet 2>/dev/null; then
        echo -e "${RED}   ❌ ESLint errors in $FILE${NC}"
        ERRORS=$((ERRORS + 1))
      fi
    fi
  done

  if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}   ✅ No ESLint errors${NC}"
  fi
else
  echo -e "${YELLOW}   ⚠️  No TypeScript files to check${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All validation checks passed!${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo -e "${RED}❌ Validation failed with $ERRORS error(s)${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Please fix the errors above before committing."
  echo "See COMPONENT_CREATION_GUIDE.md for help."
  exit 1
fi




