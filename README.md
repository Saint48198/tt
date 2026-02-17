# Trip Tracker

A full-stack trip tracking application built with Angular and Node.js using an Nx monorepo.

## Project Structure

```
tt/
├── api/                    # Node.js/Express backend API
├── frontend-app/           # Angular app for end users
├── frontend-admin/         # Angular app for administrators
└── shared/                 # Shared libraries
    ├── components/         # Shared Angular components
    ├── services/           # Shared Angular services
    ├── types/              # Shared TypeScript types
    └── util/               # Shared utilities
```

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd tt

# Install dependencies
npm install
```

## Environment Configuration

The API requires environment variables to be configured. Create a `.env` file in the root directory of the project:

```bash
# Create .env file
touch .env
```

Add the following environment variables to your `.env` file:

```env
# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_key_here

# Cloudinary Configuration (for photo storage)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# OpenCage API (for geocoding)
OPENCAGE_API_KEY=your_opencage_api_key

# Google API (for tag suggestions)
GOOGLE_API_KEY=your_google_api_key

# Gemini API (for AI-powered title suggestions)
GEMINI_API_KEY=your_gemini_api_key

# Optional: Server Port (defaults to 3001)
PORT=3001
```

**Note:** The `.env` file is gitignored and should never be committed to version control. Make sure to keep your API keys secure.

## Running the Applications

### Start All Applications

Run all applications (API, frontend-app, and frontend-admin) concurrently:

```bash
npm start
```

### Start Individual Applications

#### API (Backend)

```bash
# Using npm script
npm run serve:api

# Or using Nx
npx nx serve api
```

The API will be available at `http://localhost:3000`

#### Frontend App (User Application)

```bash
# Using npm script
npm run serve:app

# Or using Nx
npx nx serve frontend-app
```

The app will be available at `http://localhost:4200`

#### Frontend Admin (Admin Portal)

```bash
# Using npm script
npm run serve:admin

# Or using Nx
npx nx serve frontend-admin
```

The admin portal will be available at `http://localhost:4201`

### Start Multiple Specific Applications

You can run specific combinations using Nx:

```bash
# Run API and frontend-app only
npx nx run-many -t serve -p api frontend-app

# Run both frontends only
npx nx run-many -t serve -p frontend-app frontend-admin
```

## Building for Production

### Build All Applications

```bash
npm run build
```

### Build Individual Applications

```bash
# Build API
npm run build:api
# Or: npx nx build api

# Build Frontend App
npm run build:app
# Or: npx nx build frontend-app

# Build Frontend Admin
npm run build:admin
# Or: npx nx build frontend-admin
```

Build outputs will be in the `dist/` directory.

## Testing

### Run All Tests

```bash
npx nx run-many -t test
```

### Run Tests for Specific Project

```bash
npx nx test api
npx nx test frontend-app
npx nx test frontend-admin
```

### Run E2E Tests

```bash
npx nx e2e frontend-app-e2e
npx nx e2e frontend-admin-e2e
npx nx e2e api-e2e
```

## Linting

```bash
# Lint all projects
npx nx run-many -t lint

# Lint specific project
npx nx lint api
npx nx lint frontend-app
npx nx lint frontend-admin
```

## Useful Nx Commands

```bash
# View project dependency graph
npx nx graph

# See affected projects (based on git changes)
npx nx affected -t build
npx nx affected -t test

# List available projects
npx nx show projects
```

## Application Ports

| Application      | Default Port |
|------------------|--------------|
| API              | 3000         |
| Frontend App     | 4200         |
| Frontend Admin   | 4201         |

## Authentication

- **Frontend App**: Public user application (no auth required)
- **Frontend Admin**: Requires admin role authentication

## License

MIT
