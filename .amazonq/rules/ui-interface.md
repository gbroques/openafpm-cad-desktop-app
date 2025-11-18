# UI Interface Documentation

## Application Layout

### Header
- Application title: "OpenAFPM CAD"
- Theme toggle button (light/dark mode)

### Main Content Area
- Tabbed interface with 4 primary tabs
- Full-height content area for each tab

## Tab Structure

### 1. Inputs Tab
- **Purpose**: Parameter configuration for wind turbine design
- **Components**:
  - Preset selector dropdown
  - Parameter input form with grouped fieldsets
  - Form validation and error handling
  - Generate/Update button
  - Loading spinner during processing
- **Behavior**: Generating new configuration cancels existing load operations for Visualize, CNC, and Dimensions tabs

### 2. Visualize Tab
- **Purpose**: 3D visualization of generated CAD model
- **Components**:
  - 3D viewer using openafpm-cad-visualization
  - Assembly selector (Stator, Rotor, etc.)
  - Navigation rail for assembly switching
  - Download archive button
  - Empty state when no model loaded
- **Loading**: Longest loading time (~1 minute), depends on `load_all` function
- **Behavior**: Users can switch assemblies before default "Wind Turbine" assembly finishes loading

### 3. CNC Tab
- **Purpose**: CNC machining overview and file export
- **Components**:
  - SVG diagrams showing machining operations
  - Download DXF files button
  - Loading states for SVG generation
  - Error handling for export operations
- **Loading**: Medium loading time, depends on `load_all` function

### 4. Dimensions Tab
- **Purpose**: Manufacturing specifications and measurements
- **Components**:
  - Dimension tables for different assemblies
  - Tabular data display
  - Loading states for table generation
- **Loading**: Shortest loading time, depends on `load_all` function

## UI Components

### Custom Elements
- `x-app` - Main application container
- `x-theme-toggle` - Light/dark theme switcher
- `x-empty-state` - Empty state display
- `x-error-banner` - Error message display
- `x-circular-progress` - Loading spinner
- `x-navigation-rail` - Assembly navigation
- `x-tab-panel` - Tab content container

### Material Design Integration
- Uses Material Web Components
- Material Design typography scale
- Consistent spacing and theming
- Responsive design patterns

## State Management

### Application State
- Current preset selection
- Parameter values by preset
- Form validation state
- Loading states for async operations
- Error messages for failed operations
- Current tab and assembly selection

### Data Flow
- User input triggers parameter updates
- Form submission sends data to Python backend
- Results update visualization and export options
- Error states provide user feedback
