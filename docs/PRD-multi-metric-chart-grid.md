# Product Requirements Document: Multi-Metric Chart-Grid View

## 1. Overview

### 1.1 Purpose
Enable Business Executives to quickly view a summary of their business performance across multiple metrics simultaneously and identify where they need to take action.

### 1.2 Goals
- Provide a consolidated view of multiple business metrics in a single screen
- Maintain consistency across metrics through global controls
- Enable rapid identification of performance trends and anomalies
- Reduce time-to-insight by presenting key information in a scannable, tabular format

### 1.3 Success Metrics
- Executives can view 3+ metrics simultaneously without scrolling horizontally
- Reduce time to identify actionable insights by 50%
- Maintain all existing single-metric functionality

## 2. Current State

### 2.1 Existing Architecture
The current application displays a single metric with:
- **Chart**: Full-width time series visualization
- **Controls**: Aggregation, Shadow, Goal, Forecast, Focus Period
- **Info Panels**: 2x3 grid layout (6 panels total)
  - Column 1: Current selection data (panels 1, 3, 5)
  - Column 2: Focus period data (panels 2, 4, 6)
  - Panel pairs:
    - 1 & 2: Primary metric values
    - 3 & 4: Shadow comparisons
    - 5 & 6: Goal comparisons

### 2.2 Current Limitations
- Only one metric visible at a time
- Difficult to compare performance across multiple metrics
- Repetitive navigation required to view different metrics
- No cross-metric consistency in settings

## 3. Proposed Solution

### 3.1 Multi-Metric Grid View
Transform the single-metric view into a multi-row tabular layout where each row represents one metric.

### 3.2 Control Hierarchy

#### 3.2.1 Global Controls (Applied to All Metrics)
The following controls operate at the application level and affect all visible metrics consistently:

1. **Aggregation**
   - Single aggregation configuration applied to all metrics
   - Ensures consistent time granularity across metrics
   - Location: Above the metric grid

2. **Shadow**
   - Single shadow configuration (which periods, averaging, etc.)
   - All metrics compare against the same historical period(s)
   - Location: Above the metric grid

3. **Focus Period**
   - Single focus period selection applied to all metrics
   - Enables consistent time-based comparisons
   - Location: Above the metric grid

#### 3.2.2 Local Controls (Per-Metric)
The following controls remain specific to each individual metric:

1. **Goal**
   - Each metric can have its own goal(s)
   - Different metrics may have different target values and types
   - Location: Within each metric row

2. **Forecast**
   - Each metric can have independent forecast configuration
   - Different metrics may require different forecasting approaches
   - Location: Within each metric row

### 3.3 Row Layout

Each metric row contains four sections:

#### Section A: Metric Identity (Left)
- **Name**: Metric title (editable)
- **Description**: Brief explanation (editable)
- **Controls**: Local controls (Goal, Forecast) for this metric
- Width: ~200px fixed

#### Section B: Time Series Chart (Center-Left)
- **Minimal visualization** of the time series
- Shows ONLY:
  - Primary series line (blue)
  - Forecast line if enabled (dashed blue with confidence interval)
  - Focus period highlight (yellow overlay)
  - No shadows, no goals, no data points
- Compact height: ~80-100px (reduced from current 500px)
- **No X-axis ticks or labels** (shown once at bottom of entire grid)
- Y-axis with minimal ticks (2-3 values)
- Interactive hover with crosshair and value tooltip
- Supports zoom/pan interactions (synchronized across all metrics)
- **X-axis date range perfectly aligned** across all metric rows
- Width: Flexible (minimum 400px)

#### Section C: Selection Columns (Center-Right)
Each value gets its own sortable column:
- **Column C1**: Selection Value (current point value)
- **Column C2**: Selection Point Value (if aggregation enabled, shows raw point)
- **Column C3**: Selection vs. Shadow (absolute difference)
- **Column C4**: Selection vs. Shadow % (percentage difference)
- **Column C5**: Selection vs. Goal (absolute difference)
- **Column C6**: Selection vs. Goal % (percentage difference)
- Width: ~480px (6 columns × ~80px each)

#### Section D: Focus Period Columns (Right)
Each value gets its own sortable column:
- **Column D1**: Focus Period Mean
- **Column D2**: Focus Period Range (min-max)
- **Column D3**: Focus Period vs. Shadow (absolute difference)
- **Column D4**: Focus Period vs. Shadow % (percentage difference)
- **Column D5**: Focus Period vs. Goal (absolute difference)
- **Column D6**: Focus Period vs. Goal % (percentage difference)
- Width: ~480px (6 columns × ~80px each)

### 3.4 Total Row Dimensions
- **Minimum width**: ~1560px (200 + 400 + 480 + 480)
- **Height per row**: ~80-100px (chart height only, very compact)
- **Responsive behavior**: Chart section (B) scales when additional width available; columns remain fixed width

### 3.5 Grid-Level Elements
- **Shared X-axis**: Single x-axis with date labels at the bottom of the entire grid
  - Positioned below the last metric row
  - Aligned with the chart column (Section B)
  - Shows date ticks and labels for all charts above
  - Updates when zooming/panning any chart
- **Column Headers**: Sticky header row above all metrics
  - Shows labels for all columns (C1-C6, D1-D6)
  - Each header is clickable for sorting
  - Remains visible when scrolling vertically

## 4. Detailed Requirements

### 4.1 Global Control Panel

#### 4.1.1 Layout
- Fixed header above the metric grid
- Always visible (sticky/fixed positioning)
- Contains three control groups: Aggregation, Shadow, Focus Period

#### 4.1.2 Aggregation Controls
- Function selection (sum, average, min, max, first, last)
- Time bucket selection (day, week, month, quarter, year)
- Enable/disable toggle
- Applied synchronously to all metrics

#### 4.1.3 Shadow Controls
- Period configuration (e.g., "1 year ago")
- Multiple shadow support with averaging option
- Enable/disable toggle
- Shadow visibility applies to all metrics

#### 4.1.4 Focus Period Controls
- Start date selection
- End date selection (or duration)
- Optional label/name
- Enable/disable toggle
- Visual highlight appears on all metric charts

### 4.2 Metric Row Component

#### 4.2.1 Metric Identity Section
**Name & Description:**
- Editable on double-click (consistent with current behavior)
- Vertically aligned to top of row
- Fixed width container

**Local Controls:**
- Goal configuration button/panel
  - Number of goals
  - Goal type (continuous, end-of-period)
  - Goal values
  - Goal labels
  - Color selection
- Forecast configuration button/panel
  - Enable/disable
  - Forecast horizon (days)
  - Method selection
  - Confidence interval toggle

#### 4.2.2 Time Series Chart Section
**Minimal Chart Features:**
- **Shows only:**
  - Primary series line (blue, 2px width)
  - Forecast if enabled (dashed blue line + shaded confidence interval)
  - Focus period highlight (yellow semi-transparent overlay)
  - Gap detection and handling (line breaks)
- **Does NOT show:**
  - Shadow series (shown in columns instead)
  - Goal lines (shown in columns instead)
  - Raw data points
  - Any labels or legends on the chart itself
- **Axes:**
  - Y-axis: Left side only, minimal ticks (2-3 values), small font (9px)
  - X-axis: NONE (shared x-axis at bottom of grid shows dates)
  - No axis labels/titles
  - Minimal margins (top: 5px, bottom: 0px, left: 40px, right: 5px)
- **Compact height:** 80-100px total
- **Interactive features:**
  - Hover shows vertical crosshair line across ALL charts
  - Tooltip shows date and value
  - Click-drag to zoom (x and y)
  - Alt-drag to pan
  - Scroll wheel to zoom
  - Double-click to reset
  - No zoom instruction overlay (shown once at grid level)

**Chart Synchronization:**
- **X-axis perfectly synchronized** across all visible metrics:
  - Same domain (date range) for all charts
  - Same pixel width for all charts
  - Zoom/pan on one chart affects all charts
  - Shared x-axis at grid bottom always matches all charts
- **Y-axis independent** per metric (different value ranges)
- **Hover synchronized:** vertical crosshair appears at same x-position on all charts

#### 4.2.3 Selection Columns Section
Each column displays a single value for the currently hovered/selected point:

**Column C1: Selection Value**
- Current value at selected point
- Forecast indicator if applicable
- Compact number display
- Sortable (ascending/descending)

**Column C2: Selection Point Value**
- Raw point value (only shown if aggregation enabled)
- Shows unaggregated data point
- Compact number display
- Sortable (ascending/descending)

**Column C3: Selection vs. Shadow (Absolute)**
- Absolute difference from shadow (+/-)
- Green for positive, red for negative
- Empty if no shadow
- Sortable (highest positive to highest negative)

**Column C4: Selection vs. Shadow (%)**
- Percentage difference from shadow
- Green for positive, red for negative
- Empty if no shadow
- Sortable (highest % to lowest %)

**Column C5: Selection vs. Goal (Absolute)**
- Absolute difference from goal (+/-)
- Green for positive, red for negative
- Empty if no goal
- Sortable (highest positive to highest negative)

**Column C6: Selection vs. Goal (%)**
- Percentage difference from goal
- Green for positive, red for negative
- Empty if no goal
- Sortable (highest % to lowest %)

#### 4.2.4 Focus Period Columns Section
Each column displays a single value for the focus period:

**Column D1: Focus Period Mean**
- Mean value over focus period
- Forecast indicator if period includes forecast
- Compact number display
- Empty if no focus period
- Sortable (ascending/descending)

**Column D2: Focus Period Range**
- Min-max range display (e.g., "10.2 - 15.8")
- Empty if no focus period
- Sortable (by range width: max-min)

**Column D3: Focus Period vs. Shadow (Absolute)**
- Absolute difference of means
- Green for positive, red for negative
- Empty if no focus period or shadow
- Sortable (highest positive to highest negative)

**Column D4: Focus Period vs. Shadow (%)**
- Percentage difference of means
- Green for positive, red for negative
- Empty if no focus period or shadow
- Sortable (highest % to lowest %)

**Column D5: Focus Period vs. Goal (Absolute)**
- Absolute difference from goal mean
- Green for positive, red for negative
- Empty if no focus period or goal
- Sortable (highest positive to highest negative)

**Column D6: Focus Period vs. Goal (%)**
- Percentage difference from goal mean
- Green for positive, red for negative
- Empty if no focus period or goal
- Sortable (highest % to lowest %)

### 4.3 Column Header Design

Each column has a sortable header:

1. **Header Row:**
   - Column label (e.g., "Selection", "vs. Shadow %", "Focus Mean")
   - Sort indicator (up/down arrow when active)
   - Clickable to toggle sort direction
   - Sticky header remains visible when scrolling vertically

2. **Column Cell Design:**
   - Single value per cell
   - Compact font (14-16px)
   - Color coding for positive/negative (green/red)
   - Right-aligned numbers
   - Empty state indicator ("—" or blank) when not applicable

3. **Visual Hierarchy:**
   - Alternating row backgrounds for readability
   - Border between column groups (Selection vs. Focus Period)
   - Subtle hover effect on rows

### 4.4 Metric Management

#### 4.4.1 Adding Metrics
- "Add Metric" button at bottom of grid
- Opens file picker or metric selection dialog
- New metric appears as new row at bottom
- Inherits global settings (aggregation, shadow, focus period)
- Starts with no local settings (no goal, no forecast)

#### 4.4.2 Removing Metrics
- Delete/remove button within each row
- Confirmation dialog before removal
- Minimum: 1 metric must remain visible

#### 4.4.3 Reordering Metrics
- **Manual Reordering**: Drag-and-drop handle on each row
  - Metrics can be reordered by dragging rows up/down
  - Order persists across sessions
- **Automatic Sorting**: Click any column header to sort
  - Each column is independently sortable
  - Click once: sort descending
  - Click twice: sort ascending
  - Click third time: clear sort (return to manual order)
  - Sort indicator (↑↓) shows in active column header
  - Only one column sorted at a time
  - Sorting is dynamic - updates when values change (e.g., when hovering over different dates)
  - Examples:
    - Click "Selection" to sort by current hovered value
    - Click "vs. Goal %" to find biggest over/under performers
    - Click "Focus Mean" to rank metrics by focus period average

#### 4.4.4 Metric Expansion / Single-Metric View
Users can "zoom in" to view a single metric with full detail:

**Triggering Expansion:**
- Click "Expand" icon/button on any metric row
- Or double-click the chart area
- Or keyboard shortcut (e.g., Enter when row focused)

**Single-Metric View:**
- Full-screen (or large modal) display of selected metric
- Uses current TimeSeriesChart component with all features:
  - Large chart (current 500px height)
  - Shows primary series, shadows, goals, forecast
  - Full x-axis with ticks and labels
  - Interactive data point markers
  - Hover tooltips with full detail
  - All zoom/pan controls
  - Full 2x3 panel grid (current layout)
- **Retains global settings:**
  - Uses global aggregation configuration
  - Uses global shadow configuration
  - Uses global focus period
- **Shows local settings:**
  - Metric-specific goals
  - Metric-specific forecast

**Returning to Grid View:**
- "Back to Grid" button (prominent, top-left)
- Or ESC key
- Or click outside modal (if modal design)
- Returns to same scroll position in grid
- Preserves any zoom/pan state applied in single-metric view

**State Preservation:**
- When returning to grid, any changes to global settings apply to all metrics
- Any changes to local settings (goals, forecast) saved to that metric
- Grid view reflects current selection/hover state from single-metric view

### 4.5 Responsive Behavior

#### 4.5.1 Minimum Width: 1080px
- Below this width, horizontal scroll appears
- All sections maintain minimum widths

#### 4.5.2 Standard Width: 1400-1920px
- Chart section expands to use available space
- Panel sections remain fixed width
- Metric identity section remains fixed width

#### 4.5.3 Wide Screens: 1920px+
- Chart section continues to expand
- Optional: Panels could increase size proportionally
- Maintain maximum chart width to prevent over-stretching

### 4.6 Data Management

#### 4.6.1 State Structure
```typescript
interface AppState {
  // Global settings
  globalAggregation?: AggregationConfig;
  globalShadows?: Shadow[];
  globalAverageShadows?: boolean;
  globalFocusPeriod?: FocusPeriod;

  // Metric list
  metrics: Array<{
    id: string;
    series: Series;
    localGoals?: Goal[];
    localForecast?: ForecastConfig;
    order: number;
  }>;
}
```

#### 4.6.2 Persistence
- Save/load multiple metrics
- Persist global settings
- Persist metric order
- File format: Single JSON file containing all metrics and settings

### 4.7 Performance Considerations

#### 4.7.1 Rendering Optimization
- Virtualization if >10 metrics visible
- Debounce global control changes
- Throttle synchronized chart interactions
- Lazy load charts as they enter viewport

#### 4.7.2 Data Processing
- Process aggregation for all metrics in single pass
- Cache shadow calculations
- Reuse forecast calculations when configuration unchanged

## 5. User Stories

### 5.1 Executive Dashboard View
**As a** Business Executive
**I want to** view multiple key metrics simultaneously
**So that** I can quickly assess overall business performance

**Acceptance Criteria:**
- Can view 3-5 metrics on a single screen without scrolling
- All metrics show consistent time periods
- Can identify trends and anomalies within 30 seconds

### 5.2 Consistent Time-Based Analysis
**As a** Business Analyst
**I want to** apply the same time aggregation and focus period to all metrics
**So that** I can ensure apples-to-apples comparisons

**Acceptance Criteria:**
- Changing aggregation updates all metrics simultaneously
- Selecting a focus period highlights the same period on all charts
- Shadow comparisons use the same historical period for all metrics

### 5.3 Metric-Specific Goals
**As a** Department Manager
**I want to** set different goals for different metrics
**So that** I can track performance against relevant targets

**Acceptance Criteria:**
- Each metric can have independent goals
- Goal configuration is easily accessible per metric
- Goal comparisons display clearly in condensed panels

### 5.4 Quick Problem Identification
**As a** Operations Manager
**I want to** scan multiple metrics and immediately see which are underperforming
**So that** I can prioritize my attention and actions

**Acceptance Criteria:**
- Red/green color coding clearly indicates performance vs goals
- Focus period statistics show at-a-glance health
- Can identify problem areas within 10 seconds

### 5.5 Performance-Based Sorting
**As a** Business Executive
**I want to** sort metrics by performance indicators (e.g., biggest goal deviation)
**So that** I can immediately focus on the most critical issues

**Acceptance Criteria:**
- Can sort by any panel value (selection, shadow comparison, goal comparison, focus period values)
- Sort order updates dynamically as I hover over different time points
- Visual indicator shows active sort criteria
- Can easily clear sort and return to custom order

### 5.6 Deep Dive on Individual Metrics
**As a** Business Analyst
**I want to** expand a single metric to see full detail with all overlays
**So that** I can investigate trends and anomalies more deeply

**Acceptance Criteria:**
- Can expand any metric with one click
- Expanded view shows all current features (shadows, goals, full panels)
- Easy to return to grid view (back button, ESC key)
- Grid view remembers my position and state when I return
- Global settings changes in expanded view apply to all metrics

## 6. Design Considerations

### 6.1 Visual Hierarchy
- Global controls visually distinct from metric rows
- Clear separation between rows
- Consistent use of color for positive/negative indicators
- Maintain brand/style consistency with current design

### 6.2 Information Density
- Balance between compactness and readability
- Ensure text remains legible at smaller sizes
- Maintain sufficient white space to prevent visual clutter
- Use progressive disclosure for advanced settings

### 6.3 Accessibility
- Maintain WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast in condensed panels
- Don't rely solely on color for positive/negative indication

## 7. Technical Implementation Phases

### Phase 1: Foundation
- Create global state management structure
- Implement global control panel component
- Refactor current components to support both single and multi-metric modes

### Phase 2: Row Component & Grid Layout
- Create MetricRow component with compact chart
- Implement condensed column cells
- Create grid container with column headers
- Add shared x-axis component
- Implement chart synchronization (zoom/pan/hover)
- Test multi-row layout

### Phase 3: Metric Management & View Switching
- Add metric management (add/remove/reorder)
- Implement column-based sorting
- Create single-metric expanded view
- Implement view switching (grid ↔ single-metric)
- State preservation between views

### Phase 4: Polish & Optimization
- Performance optimization (virtualization, caching)
- Edge case handling
- Error states and loading states
- Documentation and testing

## 8. Open Questions

1. How many metrics should be supported simultaneously? (Recommend max 10-15)
2. Should we support different view modes (e.g., compact, comfortable, spacious)?
3. Should chart height be configurable per row or globally?
4. How should we handle very long metric names/descriptions?
5. Should there be metric grouping/categorization support?
6. Should the single-metric expanded view be a modal or full-page replacement?
7. Should we add a "Compare 2 Metrics" view that shows two metrics side-by-side in expanded view?

## 9. Out of Scope (For Initial Release)

- Metric-to-metric comparison calculations
- Cross-metric aggregations (e.g., sum of multiple metrics)
- Custom row templates or layouts
- Export of multi-metric view as image/PDF
- Real-time data updates
- Collaborative features (sharing, comments)
- Mobile/tablet optimized views

## 10. Success Criteria

### 10.1 Functional Success
- ✅ Users can view minimum 3 metrics simultaneously
- ✅ Global controls affect all metrics consistently
- ✅ Local controls work independently per metric
- ✅ All existing single-metric features preserved
- ✅ Performance remains acceptable (< 2s load time for 5 metrics)

### 10.2 User Experience Success
- ✅ Users report 50%+ reduction in time-to-insight
- ✅ No increase in errors or confusion vs. single-metric view
- ✅ 90%+ of test users can successfully add and configure a new metric
- ✅ Positive feedback on information density and readability

## 11. Appendix

### 11.1 Terminology
- **Metric**: A time series dataset with associated metadata
- **Global Control**: A setting that applies to all visible metrics
- **Local Control**: A setting specific to one metric
- **Selection**: The currently hovered/clicked point on a time series
- **Focus Period**: A user-defined time range for aggregate analysis
- **Shadow**: Historical comparison data (e.g., "same period last year")

### 11.2 References
- Current TimeSeriesChart component
- Existing aggregation, shadow, goal, forecast implementations
- Current state management approach
