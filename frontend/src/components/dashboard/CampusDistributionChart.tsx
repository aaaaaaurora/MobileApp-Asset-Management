import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface CampusDistributionProps {
  distributionData: Record<string, number> | null;
}

export default function CampusDistributionChart({ distributionData }: CampusDistributionProps) {
  const labels = distributionData ? Object.keys(distributionData) : [];
  const seriesData = distributionData ? Object.values(distributionData) : [];

  const hasData = seriesData.length > 0 && seriesData.some((val) => val > 0);

  const series = [
    {
      name: 'Asset Censiti',
      data: seriesData,
    },
  ];

  const options: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false } },
    colors: ['#10B981'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        columnWidth: '50%',
      },
    },
    dataLabels: { enabled: true },
    xaxis: {
      categories: labels,
      title: { text: 'Numero di Asset' },
    },
    grid: {
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
  };

  return (
    <div className="rounded-xl border border-stroke bg-white px-5 pt-7 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5">
      <div className="mb-4">
        <h4 className="text-xl font-bold text-black dark:text-white">
          Distribuzione nei Campus
        </h4>
        <p className="text-sm font-medium">Volumi per polo universitario</p>
      </div>

      <div id="campusChart">
        {hasData ? (
          <ReactApexChart options={options} series={series} type="bar" height={300} />
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
            Nessun dato per i campus selezionati.
          </div>
        )}
      </div>
    </div>
  );
}