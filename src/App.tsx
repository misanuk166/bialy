import { useState } from 'react';
import { CSVUpload } from './components/CSVUpload';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { SmoothingControls } from './components/SmoothingControls';
import { ShadowControls } from './components/ShadowControls';
import type { Series } from './types/series';
import type { SmoothingConfig } from './utils/smoothing';
import type { Shadow } from './types/shadow';

function App() {
  const [series, setSeries] = useState<Series | null>(null);
  const [smoothingConfig, setSmoothingConfig] = useState<SmoothingConfig>({
    enabled: false,
    period: 7,
    unit: 'days'
  });
  const [shadows, setShadows] = useState<Shadow[]>([]);
  const [averageShadows, setAverageShadows] = useState(false);

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
              </div>
              <div className="w-full">
                <TimeSeriesChart
                  series={series}
                  smoothingConfig={smoothingConfig}
                  shadows={shadows}
                  averageShadows={averageShadows}
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
