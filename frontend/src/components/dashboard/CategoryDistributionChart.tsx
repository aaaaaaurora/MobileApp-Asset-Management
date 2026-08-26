import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface CategoryDistributionProps {
  distributionData: Record<string, number> | null;
}

export default function CategoryDistributionChart({ distributionData }: CategoryDistributionProps) {
  // Preparazione dei dati: estraiamo nomi (labels) e valori (series) dall'oggetto del backend
  const labels = distributionData ? Object.keys(distributionData) : [];
  const series = distributionData ? Object.values(distributionData) : [];

  const hasData = series.length > 0 && series.some((val) => val > 0);

  const options: ApexOptions = {
    chart: { type: 'donut' },
    colors: ['#3C50E0', '#6577F3', '#8FD0EF', '#0FADCF', '#10B981'],
    labels: labels,
    legend: {
      show: true,
      position: 'bottom',
    },
    plotOptions: {
      pie: {
        donut: { size: '65%' },
      },
    },
    dataLabels: { enabled: false },
  };

  return (
    <div className="rounded-xl border border-stroke bg-white px-5 pt-7 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5">
      <div className="mb-3 justify-between gap-4 sm:flex">
        <div>
          <h4 className="text-xl font-bold text-black dark:text-white">
            Distribuzione per Categoria
          </h4>
        </div>
      </div>

      <div className="mb-2">
        <div id="categoryChart" className="mx-auto flex justify-center">
          {hasData ? (
            <ReactApexChart options={options} series={series} type="donut" height={300} />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              Nessun dato storico disponibile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}