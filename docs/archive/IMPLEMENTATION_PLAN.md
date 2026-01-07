# Implementation Plan: Multi-Metric Chart-Grid View

## Overview
This document outlines the step-by-step implementation plan for transforming the single-metric time series application into a multi-metric chart-grid view with global controls and individual metric expansion capabilities.

## Current State Analysis

### Existing Components
- `TimeSeriesChart.tsx` - Main chart component (500px height, full featured)
- `App.tsx` - Current single-metric application
- Control components for aggregation, shadows, goals, forecast, focus period
- Type definitions in `types/` directory

### Existing State Management
- Single series with local state
- Individual controls per metric
- File-based persistence

## Implementation Phases

---

## Phase 1: Foundation & State Architecture

### 1.1 Review Current Codebase
**Goal:** Understand existing architecture and identify reusable components

**Tasks:**
- Review `App.tsx` structure and state management
- Analyze `TimeSeriesChart.tsx` props and internal logic
- Review all control components (aggregation, shadow, goal, forecast, focus period)
- Map out current data flow and state updates
- Identify which components can be reused vs need refactoring

**Deliverable:** Architecture diagram showing current vs proposed structure

### 1.2 Design Global State Structure
**Goal:** Create unified state management for multi-metric application

**Design Decisions:**
- Global settings (aggregation, shadows, focus period) at app level
- Array of metrics with local settings (goals, forecast)
- Shared UI state (current hover position, selected sort column)
- View state (grid vs single-metric expanded)

**Key Considerations:**
- How to sync global settings across all metrics
- How to handle metric-specific state
- How to preserve state when switching views
- Performance implications of state updates

### 1.3 Create TypeScript Interfaces
**Goal:** Define comprehensive type system for new architecture

**New Types to Create:**

```typescript
// Global settings applied to all metrics
interface GlobalSettings {
  aggregation?: AggregationConfig;
  shadows?: Shadow[];
  averageShadows?: boolean;
  focusPeriod?: FocusPeriod;
}

// Individual metric with local settings
interface MetricConfig {
  id: string;
  series: Series;
  order: number;
  goals?: Goal[];
  forecast?: ForecastConfig;
}

// UI state for grid view
interface GridUIState {
  currentHoverDate?: Date;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  expandedMetricId?: string;
}

// Complete app state
interface AppState {
  globalSettings: GlobalSettings;
  metrics: MetricConfig[];
  uiState: GridUIState;
  viewMode: 'grid' | 'single-metric';
}

// Column value types for sorting
interface MetricRowValues {
  selectionValue?: number;
  selectionPointValue?: number;
  selectionVsShadowAbs?: number;
  selectionVsShadowPct?: number;
  selectionVsGoalAbs?: number;
  selectionVsGoalPct?: number;
  focusPeriodMean?: number;
  focusPeriodRange?: { min: number; max: number };
  focusPeriodVsShadowAbs?: number;
  focusPeriodVsShadowPct?: number;
  focusPeriodVsGoalAbs?: number;
  focusPeriodVsGoalPct?: number;
}
```

**Tasks:**
- Create `types/appState.ts` with all interfaces
- Update existing types to support multi-metric mode
- Add utility types for column definitions and sort configurations

**Deliverable:** Complete type definitions with documentation

---

## Phase 2: Global Controls & Chart Refactoring

### 2.1 Create Global Control Panel Component
**Goal:** Build unified control panel for app-wide settings

**Component:** `GlobalControlPanel.tsx`

**Features:**
- Three control groups: Aggregation, Shadow, Focus Period
- Sticky/fixed positioning at top of page
- Clean, compact UI design
- Updates propagate to all metrics

**Props:**
```typescript
interface GlobalControlPanelProps {
  settings: GlobalSettings;
  onAggregationChange: (config: AggregationConfig | undefined) => void;
  onShadowsChange: (shadows: Shadow[], averageShadows: boolean) => void;
  onFocusPeriodChange: (focusPeriod: FocusPeriod | undefined) => void;
}
```

**Tasks:**
- Extract/refactor aggregation controls from current app
- Extract/refactor shadow controls from current app
- Extract/refactor focus period controls from current app
- Create unified panel layout
- Add visual grouping and labels
- Test state updates

**Deliverable:** Working global control panel component

### 2.2 Create Compact Chart Component
**Goal:** Build minimal chart variant for grid rows

**Component:** `CompactTimeSeriesChart.tsx`

**Differences from Current Chart:**
- Height: 80-100px (vs 500px)
- Shows ONLY: primary series, forecast, focus period highlight
- NO shadows, goals, or data points rendered
- NO x-axis (ticks or labels)
- Minimal y-axis (2-3 ticks, 9px font)
- Minimal margins (5px top, 0px bottom, 40px left, 5px right)
- Simplified hover (crosshair + tooltip only)

**Props:**
```typescript
interface CompactTimeSeriesChartProps {
  series: Series;
  aggregationConfig?: AggregationConfig;
  forecastConfig?: ForecastConfig;
  focusPeriod?: FocusPeriod;
  xDomain: [Date, Date]; // Shared across all charts
  width: number;
  height: number;
  onHover?: (date: Date | null) => void;
  currentHoverDate?: Date;
  onZoom?: (domain: [Date, Date]) => void;
}
```

**Tasks:**
- Copy TimeSeriesChart.tsx as starting point
- Remove shadow rendering logic
- Remove goal rendering logic
- Remove data point rendering
- Remove x-axis rendering
- Simplify margins and sizing
- Update hover behavior for grid sync
- Add zoom/pan callbacks for synchronization
- Test with sample data

**Deliverable:** Working compact chart component

### 2.3 Create Shared X-Axis Component
**Goal:** Build single x-axis that serves entire grid

**Component:** `SharedXAxis.tsx`

**Features:**
- Rendered once at bottom of grid
- Aligned with chart column width
- Shows date ticks and labels
- Updates when any chart zooms/pans
- Uses same D3 scale as charts

**Props:**
```typescript
interface SharedXAxisProps {
  xDomain: [Date, Date];
  width: number;
  marginLeft: number; // Match chart left margin
}
```

**Tasks:**
- Extract x-axis logic from TimeSeriesChart
- Create standalone component
- Implement responsive width handling
- Test with various date ranges

**Deliverable:** Shared x-axis component

---

## Phase 3: Column Cells & Metric Row

### 3.1 Create Column Cell Components
**Goal:** Build reusable cells for displaying metric values

**Components:**
- `ValueCell.tsx` - Simple numeric value
- `DifferenceCell.tsx` - Difference with color coding
- `PercentageCell.tsx` - Percentage with color coding
- `RangeCell.tsx` - Min-max range display

**Common Props:**
```typescript
interface CellProps {
  value?: number | { min: number; max: number };
  precision?: number;
  sortable?: boolean;
  onSort?: () => void;
  sorted?: 'asc' | 'desc' | null;
}

interface DifferenceCellProps extends CellProps {
  showSign?: boolean; // Show +/- prefix
  colorCode?: boolean; // Green/red coloring
}
```

**Styling:**
- Compact font: 14-16px
- Right-aligned numbers
- Green for positive, red for negative
- Empty state: "—"
- Width: ~80px per cell

**Tasks:**
- Create base cell component with common styling
- Implement value formatting with precision
- Add color coding logic
- Create sort indicator UI
- Test with various value ranges

**Deliverable:** Complete set of cell components

### 3.2 Create Column Header Component
**Goal:** Build sortable column headers

**Component:** `ColumnHeader.tsx`

**Features:**
- Column label display
- Sort indicator (↑↓ arrows)
- Click to sort (desc → asc → clear)
- Sticky positioning
- Highlight active sort column

**Props:**
```typescript
interface ColumnHeaderProps {
  label: string;
  columnKey: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
  width: number;
}
```

**Tasks:**
- Design header UI with sort indicators
- Implement click handling
- Add hover effects
- Test sticky positioning

**Deliverable:** Sortable column header component

### 3.3 Create MetricRow Component
**Goal:** Build complete row integrating all sections

**Component:** `MetricRow.tsx`

**Layout:**
- Section A: Name & Description (~200px)
- Section B: Compact Chart (~400px+)
- Section C: 6 Selection Columns (~480px)
- Section D: 6 Focus Period Columns (~480px)

**Props:**
```typescript
interface MetricRowProps {
  metric: MetricConfig;
  globalSettings: GlobalSettings;
  currentHoverDate?: Date;
  xDomain: [Date, Date];
  chartWidth: number;
  onMetricUpdate: (metric: MetricConfig) => void;
  onExpand: () => void;
  onRemove: () => void;
  onHover: (date: Date | null) => void;
}
```

**Features:**
- Editable name/description (double-click)
- Local controls (Goal, Forecast buttons)
- Compact chart display
- All 12 value columns
- Expand button
- Remove button
- Drag handle (for manual reordering)

**Tasks:**
- Create row layout structure
- Integrate compact chart
- Add all column cells
- Implement edit interactions
- Add local control panels
- Calculate all metric values (selection, focus period)
- Handle hover state
- Test with various metric configurations

**Deliverable:** Complete metric row component

---

## Phase 4: Grid Container & Synchronization

### 4.1 Create Grid Container Component
**Goal:** Build main grid layout with headers and rows

**Component:** `MetricGrid.tsx`

**Features:**
- Sticky column headers
- Multiple metric rows
- Shared x-axis at bottom
- Synchronized hover state
- Synchronized zoom/pan
- Column sorting

**Props:**
```typescript
interface MetricGridProps {
  metrics: MetricConfig[];
  globalSettings: GlobalSettings;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onMetricsReorder: (metrics: MetricConfig[]) => void;
  onMetricUpdate: (metric: MetricConfig) => void;
  onMetricRemove: (metricId: string) => void;
  onMetricExpand: (metricId: string) => void;
  onSort: (columnKey: string) => void;
}
```

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Column Headers (sticky)                                 │
├─────────────────────────────────────────────────────────┤
│ Metric Row 1                                            │
├─────────────────────────────────────────────────────────┤
│ Metric Row 2                                            │
├─────────────────────────────────────────────────────────┤
│ Metric Row 3                                            │
├─────────────────────────────────────────────────────────┤
│ Shared X-Axis                                           │
└─────────────────────────────────────────────────────────┘
```

**Tasks:**
- Create grid layout structure
- Implement column header row
- Render metric rows dynamically
- Add shared x-axis
- Handle responsive width calculations
- Test with 1, 3, 5+ metrics

**Deliverable:** Working grid container

### 4.2 Implement Chart Synchronization
**Goal:** Sync zoom, pan, and hover across all charts

**Synchronization Requirements:**
1. **Shared X-Domain:** All charts use same date range
2. **Zoom Sync:** Zooming one chart updates all charts
3. **Pan Sync:** Panning one chart updates all charts
4. **Hover Sync:** Hovering one chart shows crosshair on all charts

**Implementation Approach:**
- Lift x-domain state to grid container
- Pass domain to all compact charts
- Charts emit zoom/pan events to container
- Container updates domain, triggers re-render
- Hover date state shared across all charts

**Tasks:**
- Implement shared x-domain state management
- Add zoom/pan event handlers in compact chart
- Connect callbacks to grid container
- Implement synchronized hover state
- Test zoom/pan interactions
- Test hover synchronization
- Handle edge cases (empty data, single point)

**Deliverable:** Fully synchronized charts

### 4.3 Implement Column Sorting
**Goal:** Enable sorting metrics by any column value

**Sorting Logic:**
- Click header to sort descending
- Click again to sort ascending
- Click again to clear sort (return to manual order)
- Only one column sorted at a time
- Dynamic sorting updates as hover changes

**Implementation:**
- Track current sort column and direction in state
- Calculate all row values based on current hover date
- Sort metrics array based on selected column
- Re-render grid with sorted order
- Update sort when hover changes
- Preserve manual order when sort cleared

**Tasks:**
- Implement value calculation for all 12 columns
- Create sort comparison function for each column type
- Add sort state management
- Connect column headers to sort handler
- Test sorting with various data sets
- Test dynamic updates while hovering
- Handle null/undefined values in sort

**Deliverable:** Working column-based sorting

---

## Phase 5: Metric Management & View Switching

### 5.1 Implement Metric Management
**Goal:** Enable adding, removing, and reordering metrics

**Add Metric:**
- "Add Metric" button below grid
- Opens file picker
- Loads series data
- Creates new MetricConfig with default values
- Adds to metrics array
- Inherits global settings

**Remove Metric:**
- Delete button on each row
- Confirmation dialog
- Remove from metrics array
- Enforce minimum 1 metric

**Reorder Metrics:**
- Drag handle on each row
- Drag-and-drop interaction
- Updates order property
- Re-renders grid
- Persists order

**Tasks:**
- Create "Add Metric" button and handler
- Implement file loading logic
- Create remove confirmation dialog
- Implement drag-and-drop reordering (use react-beautiful-dnd or similar)
- Test add/remove/reorder flows
- Handle edge cases

**Deliverable:** Full metric management functionality

### 5.2 Create Single-Metric Expanded View
**Goal:** Build full-detail view for individual metrics

**Component:** `SingleMetricView.tsx`

**Features:**
- Full-screen or large modal display
- Uses existing TimeSeriesChart component (500px)
- Shows all features: shadows, goals, full panels
- "Back to Grid" button
- Retains global settings
- Shows local settings
- ESC key to close

**Props:**
```typescript
interface SingleMetricViewProps {
  metric: MetricConfig;
  globalSettings: GlobalSettings;
  onClose: () => void;
  onMetricUpdate: (metric: MetricConfig) => void;
  onGlobalSettingsUpdate: (settings: GlobalSettings) => void;
}
```

**Layout:**
- Same as current App.tsx single-metric view
- Prominent "Back to Grid" button (top-left)
- All existing controls visible
- Full 2x3 panel grid

**Tasks:**
- Create single-metric view component
- Integrate existing TimeSeriesChart
- Add all control panels
- Implement "Back to Grid" button
- Handle ESC key
- Test with various metrics
- Ensure global settings changes propagate

**Deliverable:** Working single-metric expanded view

### 5.3 Implement View Switching
**Goal:** Seamless switching between grid and single-metric views

**State Management:**
- Add `viewMode` to app state ('grid' | 'single-metric')
- Track `expandedMetricId` when in single-metric mode
- Preserve scroll position and zoom state

**Switching Logic:**
- Grid → Single: Click expand button, set viewMode, store metric ID
- Single → Grid: Click back button or ESC, set viewMode to grid
- Preserve global settings across views
- Save metric changes back to array
- Restore grid scroll position

**Tasks:**
- Add view mode state to App
- Implement view routing/switching
- Connect expand buttons to view switch
- Connect back button to return to grid
- Preserve scroll position
- Test state preservation
- Test global settings sync

**Deliverable:** Seamless view switching

---

## Phase 6: App Integration & Persistence

### 6.1 Update App.tsx for Multi-Metric Mode
**Goal:** Integrate all components into main application

**New App Structure:**
```typescript
function App() {
  const [appState, setAppState] = useState<AppState>({
    globalSettings: {},
    metrics: [],
    uiState: {},
    viewMode: 'grid'
  });

  // Render based on viewMode
  return (
    <div>
      <GlobalControlPanel ... />
      {appState.viewMode === 'grid' ? (
        <MetricGrid ... />
      ) : (
        <SingleMetricView ... />
      )}
    </div>
  );
}
```

**Tasks:**
- Restructure App.tsx state
- Add global control panel
- Add conditional rendering for views
- Implement all state update handlers
- Connect all components
- Test full application flow

**Deliverable:** Integrated application

### 6.2 Implement State Persistence
**Goal:** Save/load multi-metric state to file

**File Format:**
```json
{
  "version": "2.0",
  "globalSettings": {
    "aggregation": {...},
    "shadows": [...],
    "focusPeriod": {...}
  },
  "metrics": [
    {
      "id": "metric-1",
      "series": {...},
      "order": 0,
      "goals": [...],
      "forecast": {...}
    }
  ]
}
```

**Tasks:**
- Design file format schema
- Implement save function (download JSON)
- Implement load function (file picker + parse)
- Add version migration logic
- Handle backward compatibility with v1 files
- Test save/load roundtrip
- Handle errors gracefully

**Deliverable:** Working persistence system

---

## Phase 7: Polish & Optimization

### 7.1 Responsive Behavior & Styling
**Goal:** Ensure good UX across screen sizes

**Tasks:**
- Test on various screen widths (1560px - 2560px)
- Implement horizontal scroll for narrow screens
- Ensure sticky headers work correctly
- Polish visual design (colors, spacing, borders)
- Add hover effects and transitions
- Test keyboard navigation
- Ensure accessibility (ARIA labels, focus management)

**Deliverable:** Polished, responsive UI

### 7.2 Performance Optimization
**Goal:** Ensure smooth performance with 10+ metrics

**Optimization Strategies:**
- Memoize expensive calculations (aggregations, forecasts)
- Use React.memo for row components
- Debounce hover updates
- Throttle zoom/pan events
- Consider virtualization for >10 metrics
- Profile and optimize re-renders

**Tasks:**
- Add performance monitoring
- Identify bottlenecks
- Implement optimizations
- Test with 15+ metrics
- Measure improvement

**Deliverable:** Optimized performance

### 7.3 Error Handling & Edge Cases
**Goal:** Robust error handling and edge case management

**Edge Cases to Handle:**
- Empty metrics array
- Metrics with no data
- Metrics with single data point
- Mismatched date ranges across metrics
- Very large datasets
- Invalid file formats
- Missing or corrupt data
- NaN/Infinity values

**Tasks:**
- Add error boundaries
- Implement error messages
- Add loading states
- Handle edge cases gracefully
- Add user-friendly error messages
- Test error scenarios

**Deliverable:** Robust error handling

### 7.4 Documentation & Testing
**Goal:** Comprehensive documentation and test coverage

**Documentation:**
- Update README with new features
- Add user guide for grid view
- Document keyboard shortcuts
- Add architecture documentation
- Create component API docs

**Testing:**
- Unit tests for key functions
- Component tests for major components
- Integration tests for workflows
- Manual testing checklist

**Tasks:**
- Write documentation
- Create tests
- Perform manual testing
- Fix discovered issues

**Deliverable:** Complete documentation and test coverage

---

## Phase 8: Final Review & Deployment

### 8.1 Final Testing
**Goal:** Comprehensive testing before merge

**Test Scenarios:**
- Single metric mode (ensure backward compatibility)
- 3 metrics in grid
- 10+ metrics in grid
- All sorting combinations
- All global control combinations
- Expand/collapse flows
- Add/remove metrics
- Save/load state
- Zoom/pan synchronization
- Edge cases

**Deliverable:** Tested, stable application

### 8.2 Code Review & Refinement
**Goal:** Clean, maintainable code

**Tasks:**
- Review all code for clarity
- Remove dead code
- Optimize imports
- Add comments for complex logic
- Ensure consistent code style
- Run linter and fix issues

**Deliverable:** Clean, production-ready code

### 8.3 Merge to Main
**Goal:** Integrate feature branch into main

**Tasks:**
- Commit final changes to feature branch
- Create pull request
- Address any review comments
- Merge to main branch
- Tag release version
- Update changelog

**Deliverable:** Merged feature, new release

---

## Key Milestones

1. ✅ **Phase 1 Complete:** State architecture defined, types created
2. ✅ **Phase 2 Complete:** Global controls and compact chart working
3. ✅ **Phase 3 Complete:** Column cells and metric row component working
4. ✅ **Phase 4 Complete:** Grid layout with synchronized charts
5. ✅ **Phase 5 Complete:** Metric management and view switching working
6. ✅ **Phase 6 Complete:** Integrated app with persistence
7. ✅ **Phase 7 Complete:** Polished, optimized, tested
8. ✅ **Phase 8 Complete:** Merged to main, released

---

## Risk Mitigation

### Technical Risks
- **Chart synchronization complexity:** Prototype early, test incremental changes
- **Performance with many metrics:** Profile early, optimize incrementally
- **State management complexity:** Use clear patterns, add tests

### UX Risks
- **Information overload:** User testing with real data
- **Confusing navigation:** Clear visual hierarchy, prominent controls
- **Slow interactions:** Performance budget, optimize critical paths

### Timeline Risks
- **Scope creep:** Stick to MVP, defer nice-to-haves
- **Unexpected complexity:** Buffer time in estimates
- **Integration issues:** Incremental integration, frequent testing

---

## Success Criteria

**Functional:**
- [ ] Users can view 3+ metrics in grid simultaneously
- [ ] All global controls work and affect all metrics
- [ ] Local controls work per metric
- [ ] Sorting by any column works correctly
- [ ] Charts are perfectly synchronized
- [ ] Single-metric expansion works
- [ ] State persists across sessions
- [ ] All existing features still work

**Performance:**
- [ ] Load time < 2 seconds for 5 metrics
- [ ] Smooth scrolling with 10 metrics
- [ ] Responsive hover interactions (< 50ms)
- [ ] Smooth zoom/pan (60fps)

**UX:**
- [ ] Intuitive navigation between views
- [ ] Clear visual hierarchy
- [ ] Readable at all screen sizes
- [ ] Accessible via keyboard
- [ ] No user confusion in testing

---

## Next Steps

1. Begin with Phase 1: Review codebase and design state architecture
2. Create implementation branch tracking
3. Set up regular checkpoints for review
4. Start building!
