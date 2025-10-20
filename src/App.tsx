import { useState, useEffect } from 'react';
import { CSVUpload } from './components/CSVUpload';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { SmoothingControls } from './components/SmoothingControls';
import { ShadowControls } from './components/ShadowControls';
import { GoalControls } from './components/GoalControls';
import type { Series } from './types/series';
import type { SmoothingConfig } from './utils/smoothing';
import type { Shadow } from './types/shadow';
import type { Goal } from './types/goal';

function App() {
  const [series, setSeries] = useState<Series | null>(null);
  const [smoothingConfig, setSmoothingConfig] = useState<SmoothingConfig>({
    enabled: false,
    period: 7,
    unit: 'days'
  });
  const [shadows, setShadows] = useState<Shadow[]>([]);
  const [averageShadows, setAverageShadows] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Load goals from localStorage when series is loaded
  useEffect(() => {
    if (series) {
      const storedGoals = localStorage.getItem(`bialy-goals-${series.id}`);
      if (storedGoals) {
        try {
          const parsed = JSON.parse(storedGoals);
          // Convert date strings back to Date objects
          const goalsWithDates = parsed.map((goal: Goal) => ({
            ...goal,
            startDate: goal.startDate ? new Date(goal.startDate) : undefined,
            endDate: goal.endDate ? new Date(goal.endDate) : undefined
          }));
          setGoals(goalsWithDates);
        } catch (error) {
          console.error('Failed to parse stored goals:', error);
        }
      } else {
        // Reset goals when new series is loaded
        setGoals([]);
      }
    }
  }, [series?.id]);

  // Save goals to localStorage whenever they change
  useEffect(() => {
    if (series && goals.length >= 0) {
      localStorage.setItem(`bialy-goals-${series.id}`, JSON.stringify(goals));
    }
  }, [goals, series?.id]);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="mx-auto px-6" style={{ maxWidth: '1800px' }}>
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900">Bialy</h1>
          <p className="text-gray-600 mt-2">
            Time series data visualization and analysis
          </p>
        </header>

        {!series ? (
          <CSVUpload onSeriesLoaded={setSeries} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <div className="space-y-4">
                <SmoothingControls
                  config={smoothingConfig}
                  onChange={setSmoothingConfig}
                />
                <ShadowControls
                  shadows={shadows}
                  onChange={setShadows}
                  averageTogether={averageShadows}
                  onAverageTogetherChange={setAverageShadows}
                />
                <GoalControls
                  goals={goals}
                  onChange={setGoals}
                />
              </div>
              <div className="w-full">
                <TimeSeriesChart
                  series={series}
                  smoothingConfig={smoothingConfig}
                  shadows={shadows}
                  averageShadows={averageShadows}
                  goals={goals}
                  onSeriesUpdate={setSeries}
                />
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setSeries(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Load Different Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
