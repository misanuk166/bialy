1. **OVERVIEW**

Bialy is a software tool designed to empower humans in seeing and understanding trends in time series data which models real world events.

The primary user for Bialy is a business executive seeking to monitor and react to trends in their business.

The core unit of Bialy is a business metric time series, comprising a date and a value.

The main methods of analysis are transformation, comparison, and forecasting.

Bialy’s advantage over competing products is visual clarity and GUI-driven analytics (code-free). In the future, we will also extend capbilities with agentic causal inference.

Bialy will be built with two main visual components:  
(1) A Series Viewer \- this is a times series chart and UI enabling detailed analysis of a single metric series.  
(2) Series Meta-board \- this is a grid-based dashboard summarizing information across multiple series.

First, we will build the (1) Series Viewer.

2. **SERIES VIEWER DESIGN SPECS**

**2.1. Series Chart**

The main component of the series view is a time series chart where the x-axis is a date range and the y-axis is the series value.

The chart should have a built-in hover-over interaction which shows the x,y values for any point in the series as aligned with the x-axis location of the mouse cursor. These values should be displayed in the top-right corner of the chart.

**2.2. Series Transformations**

To begin, there should be a UI option to “smooth” the series. This creates a user-input for smoothing by \[x\] (1-99) time units \[y\] (values: days, weeks, months, years). The default value should be 7-days.

If a user selects to smooth their data, then two things should happen:

1. The current time series line should transition into a series of points that are NOT connected  
2. A new time series line should be computed and displayed which represents a rolling average value based on the user input. E.g. rolling 7-day average by default.

**2.3. Shadow**

Another user action is to create a “shadow”. A shadow is a comparison of the current series value to the value for this same series in a historic period. For example, this could be compared to last week, last month, last quarter, or last year. There can be up to \[10\] shadows.

Each shadow should be a temporal transform of the current series by \[x\] \[time-periods\] where time-period is a day, week, month, quarter, or year.  
Shadows should always be show in shades of gray, with further back periods a lighter shade of gray.

**2.3. Goal**

\[to be detailed later\]

**2.4. Forecast**

\[to be detailed later\]

**2.5. Annotation**

\[to be detailed later\]

**2.6. Series Metadata**

\[to be detailed later\]

3. **SERIES META-BOARD VIEWER**

\[to be detailed later\]

