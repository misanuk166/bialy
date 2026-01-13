interface DashboardHeaderProps {
  dashboardName: string;
  readOnly: boolean;
  onShowRangeModal: () => void;
  onShowAggregationModal: () => void;
  onShowShadowModal: () => void;
  onShowAnnotationModal: () => void;
  onAddMetric: () => void;
}

export function DashboardHeader({
  dashboardName,
  readOnly,
  onShowRangeModal,
  onShowAggregationModal,
  onShowShadowModal,
  onShowAnnotationModal,
  onAddMetric
}: DashboardHeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-8 py-4 flex items-center justify-between">
        {/* Dashboard Title */}
        <h1 className="text-xl font-semibold text-gray-900">{dashboardName}</h1>

        {/* Control Buttons */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={onShowRangeModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Configure date range"
            >
              <span>📅</span>
              <span>Range</span>
            </button>

            <button
              onClick={onShowAggregationModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Configure aggregation"
            >
              <span>📊</span>
              <span>Aggregation</span>
            </button>

            <button
              onClick={onShowShadowModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Manage shadows"
            >
              <span>👁️</span>
              <span>Shadows</span>
            </button>

            <button
              onClick={onShowAnnotationModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Manage annotations"
            >
              <span>🎯</span>
              <span>Annotations</span>
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            <button
              onClick={onAddMetric}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Add a new metric"
            >
              <span>+</span>
              <span>Add Metric</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
