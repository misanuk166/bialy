import { useState } from 'react';

interface DashboardHeaderProps {
  dashboardName: string;
  dashboardDescription?: string;
  readOnly: boolean;
  isFavorite: boolean;
  onShowRangeModal: () => void;
  onShowAggregationModal: () => void;
  onShowShadowModal: () => void;
  onShowAnnotationModal: () => void;
  onShareDashboard: () => void;
  onToggleFavorite: () => void;
  onUpdateDashboard: (updates: { name?: string; description?: string }) => void;
  rangeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  aggregationButtonRef?: React.RefObject<HTMLButtonElement | null>;
  shadowButtonRef?: React.RefObject<HTMLButtonElement | null>;
  annotationButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function DashboardHeader({
  dashboardName,
  dashboardDescription,
  readOnly,
  isFavorite,
  onShowRangeModal,
  onShowAggregationModal,
  onShowShadowModal,
  onShowAnnotationModal,
  onShareDashboard,
  onToggleFavorite,
  onUpdateDashboard,
  rangeButtonRef,
  aggregationButtonRef,
  shadowButtonRef,
  annotationButtonRef
}: DashboardHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedName, setEditedName] = useState(dashboardName);
  const [editedDescription, setEditedDescription] = useState(dashboardDescription || '');

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== dashboardName) {
      onUpdateDashboard({ name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleDescriptionSave = () => {
    if (editedDescription !== dashboardDescription) {
      onUpdateDashboard({ description: editedDescription.trim() || undefined });
    }
    setIsEditingDescription(false);
  };

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="pl-1 pr-8 py-4 flex items-start justify-between">
        {/* Dashboard Title and Description */}
        <div className="flex-1 mr-4">
          {/* Title */}
          {isEditingName && !readOnly ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') {
                  setEditedName(dashboardName);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="text-xl font-semibold text-gray-900 border-b-2 border-blue-500 bg-transparent outline-none w-full"
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1
                className={`text-xl font-semibold text-gray-900 ${!readOnly ? 'cursor-pointer hover:bg-gray-50 px-2 -mx-2 rounded' : ''}`}
                onClick={() => !readOnly && setIsEditingName(true)}
                title={!readOnly ? 'Click to edit title' : ''}
              >
                {dashboardName}
              </h1>
              <button
                onClick={onToggleFavorite}
                className="text-xl hover:scale-110 transition-transform flex-shrink-0"
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                {isFavorite ? '⭐' : '☆'}
              </button>
            </div>
          )}

          {/* Description */}
          {isEditingDescription && !readOnly ? (
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleDescriptionSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditedDescription(dashboardDescription || '');
                  setIsEditingDescription(false);
                }
              }}
              autoFocus
              placeholder="Add a description..."
              className="mt-0.5 w-full text-sm text-gray-600 border border-blue-500 bg-transparent outline-none rounded px-2 py-1 resize-none block"
              rows={2}
            />
          ) : (
            <p
              className={`mt-0.5 text-sm text-gray-600 block ${!readOnly ? 'cursor-pointer hover:bg-gray-50 px-2 -mx-2 rounded min-h-[1.5rem]' : ''}`}
              onClick={() => !readOnly && setIsEditingDescription(true)}
              title={!readOnly ? 'Click to edit description' : ''}
            >
              {dashboardDescription || (!readOnly && 'Add a description...')}
            </p>
          )}
        </div>

        {/* Control Buttons */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              ref={rangeButtonRef}
              onClick={onShowRangeModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Configure date range"
            >
              <span>📅</span>
              <span>Range</span>
            </button>

            <button
              ref={aggregationButtonRef}
              onClick={onShowAggregationModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Configure aggregation"
            >
              <span>📊</span>
              <span>Aggregation</span>
            </button>

            <button
              ref={shadowButtonRef}
              onClick={onShowShadowModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Manage shadows"
            >
              <span>👁️</span>
              <span>Shadows</span>
            </button>

            <button
              ref={annotationButtonRef}
              onClick={onShowAnnotationModal}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Manage annotations"
            >
              <span>🎯</span>
              <span>Annotations</span>
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            <button
              onClick={onShareDashboard}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-1.5"
              title="Share dashboard and manage permissions"
            >
              <span>🔗</span>
              <span>Sharing</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
