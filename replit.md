# REST Express Application

## Overview

This is a full-stack sports management application built with React (frontend) and Express.js (backend). The application manages players and matches for a doubles sports league, featuring player management, match recording, statistics tracking, and pair suggestions. The architecture follows a monorepo structure with shared TypeScript schemas and modern web development practices.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite with custom configuration for development and production
- **Form Management**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Validation**: Zod schemas shared between frontend and backend
- **Development**: Hot reload with Vite integration for development mode

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Migrations**: Drizzle Kit for schema migrations
- **Schema Location**: Shared schema definitions in `/shared/schema.ts`
- **Development Fallback**: In-memory storage implementation for development/testing

## Key Components

### Database Schema
- **Players Table**: Stores player information including name and skill level (Beginner/Intermediate/Advanced)
- **Matches Table**: Records match data with team compositions, scores, and winners
- **Relationships**: Foreign key relationships between matches and players

### API Endpoints
- `GET/POST /api/players` - Player management
- `PUT/DELETE /api/players/:id` - Individual player operations  
- `GET/POST /api/matches` - Match management
- `GET /api/stats` - Statistics and analytics
- `GET /api/pairs` - Suggested player pairings

### UI Components
- **Player Management**: Create, edit, delete players with skill level categorization
- **Match Recording**: Form-based match recording with team selection and score input
- **Statistics Dashboard**: Player performance metrics and league statistics
- **Responsive Design**: Mobile-first approach with adaptive layouts

### Shared Types
- TypeScript interfaces and Zod schemas shared between client and server
- Type-safe API communication with runtime validation
- Consistent data models across the application stack

## Data Flow

1. **Client Requests**: React components use TanStack Query for API requests
2. **API Layer**: Express routes handle HTTP requests with Zod validation
3. **Data Access**: Storage layer abstracts database operations
4. **Response**: Type-safe JSON responses with error handling
5. **State Updates**: Query cache invalidation triggers UI updates

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with PostCSS processing
- **Icons**: Lucide React for consistent iconography
- **Date Handling**: date-fns for date manipulation
- **Carousels**: Embla Carousel for interactive components

### Backend Dependencies
- **Database**: Neon serverless PostgreSQL
- **Session Management**: connect-pg-simple for PostgreSQL-based sessions
- **Validation**: Zod for runtime type checking
- **Build**: esbuild for production bundling

### Development Dependencies
- **Replit Integration**: Custom plugins for Replit environment
- **Error Handling**: Runtime error overlays for development
- **Code Intelligence**: Replit Cartographer for enhanced development experience

## Deployment Strategy

### Development Mode
- Vite dev server with HMR (Hot Module Replacement)
- Express server with middleware integration
- Environment: `NODE_ENV=development`
- Database: Requires `DATABASE_URL` environment variable

### Production Build
- Frontend: Vite builds static assets to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js`
- Static serving: Express serves built frontend assets
- Database migrations: `drizzle-kit push` for schema deployment

### Environment Configuration
- **Required**: `DATABASE_URL` for PostgreSQL connection
- **Optional**: `REPL_ID` for Replit-specific features
- **Build Commands**: Separate build processes for client and server code

### Scalability Considerations
- Stateless server design for horizontal scaling
- Connection pooling through Neon's serverless architecture
- Cached queries reduce database load
- Static asset optimization through Vite build process