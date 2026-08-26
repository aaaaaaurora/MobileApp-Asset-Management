import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface DynamicAttributeProps {
  attributeName: string;
  distributionData: Record<string, number> | null;
  onAttributeChange: (attr: string) => void;
}

export default function DynamicAttributeChart({ attributeName, distributionData, onAttributeChange }: DynamicAttributeProps) {
  const labels = distributionData ? Object.keys(distributionData) : [];
  const series = distributionData ? Object.values(distributionData) : [];
  const hasData = series.length > 0 && series.some((val) => val > 0);

  const options: ApexOptions = {
    chart: { type: 'pie' },
    colors: ['#FFA70B', '#F87171', '#3BA2B8', '#9B51E0', '#10B981'],
    labels: labels,
    legend: { position: 'bottom' },
    dataLabels: { enabled: true },
  };

  return (
    <div className="rounded-xl border border-stroke bg-white px-5 pt-7 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 h-full">
      <div className="mb-3 flex justify-between gap-4">
        <div>
          <h4 className="text-xl font-bold text-black dark:text-white">
            Analisi Attributi Dinamici
          </h4>
        </div>
        
        {/* IL MENU A TENDINA PER SCEGLIERE L'ATTRIBUTO */}
        <div>
          <select
            value={attributeName}
            onChange={(e) => onAttributeChange(e.target.value)}
            className="rounded border border-stroke bg-transparent py-1 px-3 outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark"
          >
            <option value="status">Stato Conservazione</option>
            <option value="material">Materiale</option>
            <option value="reparto">Reparto di Riferimento</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        {hasData ? (
          <ReactApexChart options={options} series={series} type="pie" height={280} />
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
            Dati dinamici non disponibili per questo filtro.
          </div>
        )}
      </div>
    </div>
  );
}