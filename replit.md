# Kanteeravas Badminton Club Management System

## Overview

This is a full-stack badminton club management application built with React (frontend) and Express.js (backend). The application manages players and matches for Kanteeravas Badminton Club, featuring player management with 1-10 skill levels, match recording, statistics tracking, and intelligent doubles pair generation. The architecture follows a monorepo structure with shared TypeScript schemas and modern web development practices.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 2025)

- **Application Rebranding**: Changed name from "Badminton Club Manager" to "Kanteeravas Badminton Club"
- **Skill Level System Overhaul**: 
  - Migrated from text-based levels (Beginner/Intermediate/Advanced) to numeric scale (1-10)
  - Updated database schema to use integer skill levels
  - Modified UI components to display "Level X" format with category indicators
  - Updated pair generation logic to use numeric skill differences
- **Enhanced User Experience**: 
  - Skill level dropdown now shows "1 - Beginner", "5 - Intermediate", "9 - Advanced" format
  - Balance analysis uses ≤2 skill point difference threshold
  - Filter options updated to use skill ranges: "Beginner (1-3)", "Intermediate (4-7)", "Advanced (8-10)"
- **Role-Based Access Control System**:
  - Added Manager and Player role distinction with different permissions
  - Initial setup flow for creating the first manager account
  - Login system allowing users to select their profile
  - Manager permissions: Create, edit, delete players; assign roles to new players; record matches
  - Player permissions: View-only access to players and matches, can view statistics and pairs
  - Performance-based skill level suggestions with detailed reasoning after 3+ matches
  - Match recording restricted to managers only for data integrity
- **Database Integration & Data Management** (Latest - January 2025):
  - Migrated from in-memory storage to PostgreSQL with Drizzle ORM
  - Persistent data storage ensures data survives application restarts
  - Added comprehensive database schema with proper relations between players and matches
  - Implemented DatabaseStorage class with full CRUD operations
  - Added manager-only data reset functionality for cleaning all application data
  - Database migrations handled automatically via `npm run db:push`
- **Custom Branding & UI Enhancements** (January 2025):
  - Integrated custom Kanteerava lion logo throughout application
  - Replaced generic crown icons with authentic club branding
  - Logo appears in navbar, login page, and setup page at appropriate sizes
  - Fixed match form validation logic for proper team selection handling
  - Improved error messaging for incomplete vs duplicate player selections
- **Session Persistence & Authentication Improvements** (January 2025):
  - Implemented server-side session management using express-session with PostgreSQL storage
  - Added seamless localStorage sync with server sessions for robust authentication state
  - Fixed React hooks order violations that were causing application crashes
  - Authentication state now persists across page refreshes and browser sessions
  - Users remain logged in until explicit logout or session expiration
- **Enhanced Dynamic Skill Level System** (January 2025):
  - Upgraded skill level calculator to consider opposition team strength in addition to wins/losses
  - Weighted performance scoring system that rewards beating stronger opponents and penalizes losses to weaker ones
  - Automatic skill level adjustments based on weighted performance over last 3 matches (threshold: ±0.5)
  - Enhanced suggestion system provides more intelligent recommendations based on opponent quality
  - Real-time skill level updates display in Player Management with proper query synchronization
- **Advanced Statistics Ranking System** (January 2025):
  - Enhanced ranking logic for both Individual and Team statistics
  - Multi-tier ranking: 1) Win rate (highest first), 2) Number of wins (if win rate tied), 3) Point difference (if wins tied)
  - Added point tracking (points for, points against, point difference) for comprehensive performance analysis
  - Individual Stats now only displays players who have played at least 1 match for cleaner presentation
  - Point difference displayed with color coding (green for positive, red for negative)

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
- **Players Table**: Stores player information including name and skill level (1-10 numeric scale)
- **Matches Table**: Records match data with team compositions, scores, and winners
- **Relationships**: Foreign key relationships between matches and players

### Skill Level System
- **Scale**: 1-10 numeric rating system
- **Categories**: 1-3 (Beginner), 4-7 (Intermediate), 8-10 (Advanced)
- **Balance Logic**: Pairs with skill difference ≤2 are considered "Balanced"

### API Endpoints
- `GET/POST /api/players` - Player management
- `PUT/DELETE /api/players/:id` - Individual player operations  
- `GET/POST /api/matches` - Match management
- `GET /api/stats` - Statistics and analytics
- `GET /api/pairs` - Suggested player pairings

### UI Components
- **Player Management**: Create, edit, delete players with 1-10 skill level selection
- **Doubles Pair Generator**: Automatic generation of all possible team combinations with balance analysis
- **Match Recording**: Form-based match recording with team selection and score input
- **Statistics Dashboard**: Player performance metrics and club statistics
- **Responsive Design**: Mobile-first approach with bottom navigation for mobile devices

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