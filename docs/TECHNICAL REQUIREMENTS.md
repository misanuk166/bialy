# BIALY TECHNICAL REQUIREMENTS

## 1. ARCHITECTURE OVERVIEW

Bialy will be built as a **single-page application (SPA)** with client-side data processing.

**Core Principles:**
- Client-side first: All data processing happens in the browser
- Performance-optimized: Fast in-memory computation for real-time transformations
- Progressive enhancement: Simple MVP, extensible for future features

---

## 2. TECHNOLOGY STACK

### 2.1 Frontend Framework
- **React** - Component-based UI with strong ecosystem support

### 2.2 Visualization
- **D3.js** - Maximum flexibility for custom time series visualizations
  - Enables precise control over chart interactions
  - Supports complex transformations and shadow overlays
  - Well-suited for the hover interactions and dynamic updates required

### 2.3 Styling
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development

### 2.4 State Management
- **TBD** - To be selected based on complexity needs during development
  - Options: React Context, Zustand, or Jotai
  - Will manage: series data, transformations, shadows, UI state

### 2.5 Build Tools
- **Vite** (recommended) - Fast development server and optimized builds
  - Alternative: Create React App

---

## 3. DATA ARCHITECTURE

### 3.1 Data Input
- **CSV file upload** - User-provided time series data
- **Required format**: Three columns (Date, Numerator, Denominator)
- Client-side parsing (library: PapaParse or d3.csvParse)

**CSV Format Requirements:**
```csv
date,numerator,denominator
2024-01-01,5000,1
2024-01-02,5200,1
2024-01-03,4800,1
```

**Column specifications:**
- **date**: ISO 8601 format (YYYY-MM-DD) or common date formats (MM/DD/YYYY, etc.)
- **numerator**: Numeric value (integers or decimals)
- **denominator**: Numeric value (must be > 0)

**Error Handling:**
- If CSV does not have exactly 3 columns → Show error: "CSV must contain exactly 3 columns: date, numerator, denominator"
- If column headers are missing or incorrect → Show error with expected format example
- If date parsing fails → Show error: "Invalid date format in row X. Expected format: YYYY-MM-DD"
- If numerator/denominator are not numeric → Show error: "Non-numeric value found in row X"
- If denominator is 0 or negative → Show error: "Denominator must be greater than 0 in row X"
- If duplicate dates exist → Show warning: "Duplicate dates found. Only the last value will be used."

**User Guidance:**
- Provide clear error messages with examples of correct format
- Show a sample CSV template that users can download
- Display the first few rows of the uploaded CSV for user verification before processing

### 3.2 Data Structure
```typescript
interface TimeSeriesPoint {
  date: Date;
  numerator: number;      // The numerator value (or absolute value for quantities)
  denominator: number;    // The denominator value (1 for quantities, n for rates)
}

interface SeriesMetadata {
  name: string;              // User-defined series name
  description: string;       // User-defined description of the series
  uploadDate: Date;          // Timestamp when the series was uploaded
  numeratorLabel: string;    // Label for numerator (e.g., "sales", "website visitors")
  denominatorLabel: string;  // Label for denominator (e.g., "visitors", "1" for quantities)
}

interface Series {
  id: string;                    // Unique identifier (auto-generated)
  data: TimeSeriesPoint[];       // The time series data points
  metadata: SeriesMetadata;      // Required metadata for each series
}
```

**Numerator/Denominator Structure:**
- **Quantity metrics**: numerator = actual value, denominator = 1
  - Example: "Website Visitors" → numerator: 5000, denominator: 1
- **Rate metrics**: numerator and denominator both meaningful
  - Example: "Conversion Rate" → numerator: 50 (sales), denominator: 5000 (visitors)
  - Displayed value = numerator / denominator = 0.01 (1%)
- This structure enables:
  - Proper aggregation when smoothing (sum numerators, sum denominators, then divide)
  - Accurate comparison across different time periods
  - Better understanding of statistical significance in changes

**Metadata Details:**
- **name**: User-provided or derived from CSV filename (editable)
- **description**: Optional text field for context about the metric
- **uploadDate**: Automatically captured on CSV upload (ISO 8601 format)
- **numeratorLabel**: What the numerator represents (e.g., "sales", "conversions")
- **denominatorLabel**: What the denominator represents (e.g., "visitors", "impressions", or "1")

### 3.3 In-Memory Computation
- All transformations computed in-browser
- **Performance requirements:**
  - Support series with 1000+ data points
  - Real-time smoothing calculations (< 100ms)
  - Multiple shadow computations without lag
- **Optimization strategies:**
  - Memoization for expensive calculations
  - Web Workers for heavy computations (if needed)
  - Efficient array operations (avoid unnecessary copies)

---

## 4. DEPLOYMENT

### 4.1 Hosting
- **Static hosting** via:
  - Vercel (recommended)
  - Netlify
  - GitHub Pages
- Zero backend infrastructure initially

### 4.2 Distribution
- Web-based access via URL
- No installation required
- Works on modern browsers (Chrome, Firefox, Safari, Edge)

---

## 5. KEY LIBRARIES

### Essential
- `react` - UI framework
- `d3` - Visualization and data manipulation
- `tailwindcss` - Styling

### Data Processing
- `papaparse` or `d3-dsv` - CSV parsing
- `date-fns` or `d3-time` - Date manipulation

### State Management (choose one)
- `zustand` - Lightweight state management
- `jotai` - Atomic state management
- React Context API - Built-in option

---

## 6. PERFORMANCE TARGETS

- **Initial load:** < 2 seconds
- **CSV parse & render:** < 500ms for 1000 rows
- **Smoothing transformation:** < 100ms
- **Shadow generation:** < 200ms per shadow
- **Hover interaction:** < 16ms (60fps)

---

## 7. BROWSER SUPPORT

- Modern evergreen browsers (last 2 versions)
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 8. FUTURE EXTENSIBILITY

The architecture should support future additions:
- Backend API for data persistence
- User authentication
- Real-time data streaming
- Export capabilities (PDF, PNG, CSV)
- Agentic causal inference features
- Series Meta-board dashboard

---

## 9. DEVELOPMENT WORKFLOW

### 9.1 Version Control
- Git repository
- Feature branch workflow

### 9.2 Code Quality
- TypeScript (recommended) for type safety
- ESLint for code quality
- Prettier for formatting

### 9.3 Testing (Phase 2)
- Jest + React Testing Library
- Visual regression testing for charts

---

## 10. DATA SECURITY & PRIVACY

### Current Approach
- All data stays in the user's browser
- No data transmitted to servers
- No data persistence (session-based only)

### Future Considerations
- Local storage for saving work
- Optional cloud sync with encryption
