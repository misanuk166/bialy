# Breakout by Dimension - Design Concepts

## 1. Overview

**Feature:** Breakout by Dimension - Small Multiples View
**Goal:** Enable users to explode a single metric series into multiple charts based on dimension values
**Use Case:** Analyze "Revenue" broken out by "Region" (North, South, East, West) to compare regional performance

---

## 2. Data Structure Requirements

### 2.1 Current Data Structure
```typescript
interface TimeSeriesPoint {
  date: Date;
  numerator: number;
  denominator: number;
}

interface Series {
  id: string;
  data: TimeSeriesPoint[];
  metadata: SeriesMetadata;
}
```

### 2.2 Enhanced Data Structure with Dimensions

#### Option A: Dimension as Additional Property (Recommended)
```typescript
interface TimeSeriesPoint {
  date: Date;
  numerator: number;
  denominator: number;
  dimensions?: Record<string, string>; // e.g., { "Region": "North", "Product": "Widget A" }
}

interface DimensionMetadata {
  name: string;           // e.g., "Region"
  values: string[];       // e.g., ["North", "South", "East", "West"]
  description?: string;   // Optional description of the dimension
}

interface Series {
  id: string;
  data: TimeSeriesPoint[];
  metadata: SeriesMetadata;
  dimensions?: DimensionMetadata[]; // Available dimensions in this series
}
```

#### Option B: Separate Dimension Column Structure
```typescript
interface DimensionalTimeSeriesPoint {
  date: Date;
  numerator: number;
  denominator: number;
  dimensionValue: string; // Single dimension value for this point
}

interface DimensionalSeries {
  id: string;
  dimensionName: string;  // e.g., "Region"
  dimensionValue: string; // e.g., "North"
  data: DimensionalTimeSeriesPoint[];
  metadata: SeriesMetadata;
}
```

**Recommendation:** Option A is more flexible and allows for multiple dimensions per series.

### 2.3 CSV Format Examples

#### Current Format (3 columns)
```csv
date,numerator,denominator
2023-01-01,1000,5000
2023-01-02,1200,5100
```

#### Enhanced Format with Dimension (4+ columns)
```csv
date,numerator,denominator,region
2023-01-01,250,1250,North
2023-01-01,300,1500,South
2023-01-01,220,1100,East
2023-01-01,230,1150,West
2023-01-02,260,1300,North
2023-01-02,310,1520,South
```

#### Multi-Dimension Format (5+ columns)
```csv
date,numerator,denominator,region,product
2023-01-01,150,750,North,Widget A
2023-01-01,100,500,North,Widget B
2023-01-01,200,1000,South,Widget A
2023-01-01,100,500,South,Widget B
```

---

## 3. UI/UX Design Concepts

### 3.1 Concept A: Grid Layout (Recommended for 2-8 dimensions)

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────┐
│ Revenue by Region                           [Exit Breakout]│
│ ┌──────────┐ ┌──────────┐                                  │
│ │ Dimension│ │ Layout   │                                  │
│ │ Region ▼ │ │ 2x2 Grid ▼                                  │
│ └──────────┘ └──────────┘                                  │
├────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ North           │  │ South           │                 │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │                 │
│  │ │   Chart     │ │  │ │   Chart     │ │                 │
│  │ │             │ │  │ │             │ │                 │
│  │ │             │ │  │ │             │ │                 │
│  │ └─────────────┘ │  │ └─────────────┘ │                 │
│  │ Value: 1,250    │  │ Value: 1,500    │                 │
│  │ vs Shadow: +5%  │  │ vs Shadow: +8%  │                 │
│  └─────────────────┘  └─────────────────┘                 │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ East            │  │ West            │                 │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │                 │
│  │ │   Chart     │ │  │ │   Chart     │ │                 │
│  │ │             │ │  │ │             │ │                 │
│  │ │             │ │  │ │             │ │                 │
│  │ └─────────────┘ │  │ └─────────────┘ │                 │
│  │ Value: 1,100    │  │ Value: 1,150    │                 │
│  │ vs Shadow: +3%  │  │ vs Shadow: +2%  │                 │
│  └─────────────────┘  └─────────────────┘                 │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- **Dimension Selector:** Dropdown to choose which dimension to break out by
- **Layout Options:** 1x4, 2x2, 3x2, 4x2, etc. (auto or manual)
- **Card Per Dimension Value:** Each card contains:
  - Dimension value as title (e.g., "North")
  - Compact time series chart (similar to existing chart)
  - Key metrics below chart (current value, vs shadow, vs goal)
- **Synchronized Interactions:**
  - Hover on one chart highlights same date on all charts
  - Zoom/pan on one chart affects all charts
  - Same x-axis and y-axis scaling (optional toggle)
- **Global Controls:** Aggregation, Shadow, Focus Period apply to all charts
- **Per-Chart Controls:** Goals and Forecasts can be set individually

**Advantages:**
- Familiar grid layout pattern
- Easy to compare across dimensions
- Works well for 2-8 dimension values
- Clear visual hierarchy

**Challenges:**
- Screen space limited for many dimensions (>8)
- Requires scrolling for large number of dimension values

---

### 3.2 Concept B: Tabbed Layout (Good for Many Dimensions)

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────┐
│ Revenue by Region                           [Exit Breakout]│
│ ┌──────────┐                                               │
│ │ Dimension│                                               │
│ │ Region ▼ │                                               │
│ └──────────┘                                               │
├────────────────────────────────────────────────────────────┤
│ [North] [South] [East] [West] [All Regions]               │
├────────────────────────────────────────────────────────────┤
│  Selected: North                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │                    Chart                               │ │
│  │                                                        │ │
│  │                                                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Stats Panel:                                              │
│  Current Value: 1,250      Focus Period: 1,180            │
│  vs Shadow: +5%            vs Goal: +2%                    │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- **Tab for each dimension value** plus an "All" tab showing aggregated view
- **Full-size chart** for selected dimension
- **Quick switching** between dimension values
- **Comparison mode:** Toggle to show multiple tabs side-by-side

**Advantages:**
- Works well for many dimensions (10+)
- Full screen real estate for each dimension
- Less overwhelming than showing all at once

**Challenges:**
- Harder to compare across dimensions simultaneously
- Requires clicking to switch views

---

### 3.3 Concept C: Stacked Row Layout (Best for Detailed Analysis)

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────┐
│ Revenue by Region                           [Exit Breakout]│
│ ┌──────────┐ ┌──────────┐                                  │
│ │ Dimension│ │ Sort By  │                                  │
│ │ Region ▼ │ │ Value ▼  │                                  │
│ └──────────┘ └──────────┘                                  │
├────────────────────────────────────────────────────────────┤
│ North                                      Expand [⤢]      │
│ ┌──────────────────────────────────────────────────────┐   │
│ │         Chart (compact)                              │   │
│ └──────────────────────────────────────────────────────┘   │
│ Value: 1,250  Shadow: +5%  Goal: +2%                       │
├────────────────────────────────────────────────────────────┤
│ South                                      Expand [⤢]      │
│ ┌──────────────────────────────────────────────────────┐   │
│ │         Chart (compact)                              │   │
│ └──────────────────────────────────────────────────────┘   │
│ Value: 1,500  Shadow: +8%  Goal: +5%                       │
├────────────────────────────────────────────────────────────┤
│ East                                       Expand [⤢]      │
│ ┌──────────────────────────────────────────────────────┐   │
│ │         Chart (compact)                              │   │
│ └──────────────────────────────────────────────────────┘   │
│ Value: 1,100  Shadow: +3%  Goal: -1%                       │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- **Stacked rows** similar to current MetricGrid layout
- **Sortable** by value, dimension name, variance, etc.
- **Expand button** to see full detail view for one dimension
- **Compact charts** for quick scanning
- **Statistics inline** with each row

**Advantages:**
- Familiar to existing MetricGrid users
- Sortable and scannable
- Works for any number of dimensions
- Easy to identify outliers

**Challenges:**
- Vertical scrolling required for many dimensions
- Less visual for comparison

---

### 3.4 Concept D: Hybrid Layout (Recommended)

**Combines best of Grid + Stacked:**

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────┐
│ Revenue by Region                  [Grid View] [List View] │
│ ┌──────────┐ ┌──────────┐ ┌─────────────┐ [Exit Breakout] │
│ │Dimension │ │Sort By   │ │Layout       │                 │
│ │Region ▼  │ │Value ▼   │ │Auto 2x2  ▼  │                 │
│ └──────────┘ └──────────┘ └─────────────┘                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  GRID VIEW (Default for ≤8 dimensions)                     │
│  [2x2 Grid of chart cards as in Concept A]                │
│                                                            │
│  LIST VIEW (Click to switch, or auto for >8 dimensions)   │
│  [Stacked rows as in Concept C]                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Adaptive Behavior:**
- **2-4 dimensions:** Auto 2x2 grid
- **5-8 dimensions:** Auto 3x3 or 4x2 grid
- **9+ dimensions:** Auto switch to list view (with option to force grid)
- **User can toggle** between grid and list view manually

---

## 4. Interaction Design

### 4.1 Entering Breakout Mode

**Option A: Button in Expanded Metric View**
- When viewing a single metric (expanded), show "Breakout" button
- Only enabled if series has dimensional data
- Click opens dimension selector modal

**Option B: Kebab Menu in Grid**
- Add "Breakout by..." option to metric row kebab menu
- Opens dimension selector if multiple dimensions available
- Immediately breaks out if only one dimension

**Option C: Automatic Detection**
- If CSV has 4+ columns, automatically ask user if they want to break out
- Show preview of dimension options during upload

### 4.2 Synchronized Interactions

**Hover Sync:**
- Hover over any chart shows vertical line on all charts at same date
- Tooltip shows value for each dimension at that date

**Zoom/Pan Sync:**
- Zoom on one chart zooms all charts
- Pan on one chart pans all charts
- Option to "unlink" for independent exploration

**Y-Axis Scaling:**
- Toggle: "Same Y-axis" vs "Independent Y-axis"
- Same: All charts use same min/max for easier comparison
- Independent: Each chart optimizes its own scale for detail

### 4.3 Dimension Selection

**Multi-Dimension Support:**
```
┌───────────────────────────────────┐
│ Select Dimension to Break Out     │
├───────────────────────────────────┤
│ ○ Region (4 values)               │
│   North, South, East, West        │
│                                   │
│ ○ Product (3 values)              │
│   Widget A, Widget B, Widget C    │
│                                   │
│ ○ Customer Type (2 values)        │
│   New, Returning                  │
├───────────────────────────────────┤
│         [Cancel]  [Break Out]     │
└───────────────────────────────────┘
```

**Nested Breakout (Future):**
- First break by Region → then break each region by Product
- Creates hierarchical small multiples view

### 4.4 Exiting Breakout Mode

**Clear Exit Button:**
- "Exit Breakout" or "← Back to Single View" button
- Returns to normal single metric view
- Preserves any changes to goals/forecasts made during breakout

---

## 5. Feature Compatibility

### 5.1 Global Controls (Applied to All Dimension Charts)
✅ **Aggregation** - All dimension charts use same aggregation
✅ **Shadows** - All dimension charts compare to same historical period
✅ **Focus Period** - Same focus period highlighted across all charts
✅ **Date Range** - All charts show same date range

### 5.2 Local Controls (Per Dimension Chart)
✅ **Goals** - Each dimension can have independent goals
✅ **Forecast** - Each dimension can have independent forecast config

### 5.3 New Considerations
- **Dimension-Level Aggregation:** Option to show "All Regions" aggregate view
- **Dimension Filtering:** Hide/show specific dimension values
- **Dimension Comparison:** Highlight top/bottom performers

---

## 6. Implementation Phases

### Phase 1: Data Structure Enhancement
- [ ] Update `TimeSeriesPoint` to support dimensions
- [ ] Update CSV parser to handle 4+ column format
- [ ] Add dimension detection and validation
- [ ] Create dimension metadata extraction logic

### Phase 2: UI Foundation
- [ ] Create dimension selector component
- [ ] Create breakout mode toggle/entry point
- [ ] Design dimension card/row component
- [ ] Implement layout grid system

### Phase 3: Chart Integration
- [ ] Clone existing chart component for small multiples
- [ ] Implement synchronized hover
- [ ] Implement synchronized zoom/pan
- [ ] Add y-axis scaling options

### Phase 4: Controls & Features
- [ ] Apply global controls to all dimension charts
- [ ] Enable per-dimension goals
- [ ] Enable per-dimension forecasts
- [ ] Add sorting and filtering

### Phase 5: Polish & Optimization
- [ ] Performance optimization for many dimensions
- [ ] Responsive layout handling
- [ ] Keyboard navigation
- [ ] Export/sharing functionality

---

## 7. Sample Data for Testing

### Sample CSV: Revenue by Region
```csv
date,numerator,denominator,region
2023-01-01,2500,10000,North
2023-01-01,3000,12000,South
2023-01-01,2200,9000,East
2023-01-01,2300,9500,West
2023-01-02,2600,10500,North
2023-01-02,3100,12500,South
2023-01-02,2300,9200,East
2023-01-02,2400,9800,West
2023-01-03,2550,10300,North
2023-01-03,3050,12300,South
2023-01-03,2250,9100,East
2023-01-03,2350,9600,West
```

### Sample CSV: Sales by Product and Region (Multi-Dimension)
```csv
date,numerator,denominator,region,product
2023-01-01,1500,6000,North,Widget A
2023-01-01,1000,4000,North,Widget B
2023-01-01,2000,8000,South,Widget A
2023-01-01,1000,4000,South,Widget B
2023-01-01,1300,5500,East,Widget A
2023-01-01,900,3500,East,Widget B
2023-01-01,1400,5800,West,Widget A
2023-01-01,900,3700,West,Widget B
```

---

## 8. Recommended Approach

**Start with Concept D (Hybrid Layout):**
1. Implement grid layout for ≤8 dimensions (Concept A)
2. Implement list layout for >8 dimensions (Concept C)
3. Add toggle to switch between views
4. Use adaptive logic to auto-select best layout

**First Iteration Scope:**
- Single dimension breakout only (no nested)
- Grid layout for 2-6 dimension values
- Synchronized hover, zoom, pan
- Same y-axis scaling (toggle later)
- All global controls working
- Per-dimension goals (forecasts in v2)

**Success Criteria:**
- User can upload 4-column CSV with dimension
- User can break out metric by dimension
- All charts update synchronously
- Performance acceptable for up to 8 dimension values
- Exit breakout returns to normal view

---

## 9. Open Questions

1. **Default Layout:** Should we auto-select grid vs list based on # of dimensions?
2. **Dimension Limit:** What's the max number of dimension values we support?
3. **Multi-Dimension:** Should v1 support breaking by multiple dimensions simultaneously?
4. **Persistence:** Should breakout state persist when navigating away?
5. **Comparison Mode:** Should we add a "spotlight" mode to highlight one dimension while graying others?
6. **Aggregation:** Should we always show an "All" aggregate dimension value?

---

## 10. Next Steps

1. **Review & Approve** this design document
2. **Create sample dimensional data** for testing
3. **Build data structure** enhancements
4. **Create prototype** of grid layout (Concept D)
5. **User testing** with sample data
6. **Iterate** based on feedback
