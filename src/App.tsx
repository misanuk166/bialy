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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Bialy</h1>
          <p className="text-gray-600 mt-2">
            Time series data visualization and analysis
          </p>
        </header>

        {!series ? (
          <CSVUpload onSeriesLoaded={setSeries} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <SmoothingControls
                  config={smoothingConfig}
                  onChange={setSmoothingConfig}
                />
                <ShadowControls
                  shadows={shadows}
                  onChange={setShadows}
                />
              </div>
              <div className="lg:col-span-3">
                <TimeSeriesChart
                  series={series}
                  smoothingConfig={smoothingConfig}
                  shadows={shadows}
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
