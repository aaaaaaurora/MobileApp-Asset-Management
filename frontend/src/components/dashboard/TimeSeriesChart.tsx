import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface TimeSeriesData {
  date: string;
  count: number;
}

interface TimeSeriesChartProps {
  timeSeries: TimeSeriesData[] | null;
}

export default function TimeSeriesChart({ timeSeries }: TimeSeriesChartProps) {
  const hasData = timeSeries && timeSeries.length > 0;

  const categories = hasData ? timeSeries.map((item) => item.date) : [];
  const seriesData = hasData ? timeSeries.map((item) => item.count) : [];

  const series = [
    {
      name: 'Nuovi Asset',
      data: seriesData,
    },
  ];

  const options: ApexOptions = {
    legend: { show: false },
    colors: ['#3C50E0'],
    chart: {
      type: 'area',
      height: 335,
      toolbar: { show: false },
    },
    fill: {
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      type: 'datetime',
      categories: categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      title: { text: 'Numero di Asset' },
    },
  };

  return (
    <div className="rounded-xl border border-stroke bg-white px-5 pt-7 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="flex w-full flex-wrap gap-3 sm:gap-5">
          <div>
            <h4 className="text-xl font-bold text-black dark:text-white">
              Andamento Censimento Asset
            </h4>
            <p className="text-sm font-medium">Cronologia inserimenti</p>
          </div>
        </div>
      </div>

      <div>
        <div id="timeSeriesChart" className="-ml-5">
          {hasData ? (
            <ReactApexChart options={options} series={series} type="area" height={350} />
          ) : (
            <div className="flex h-[350px] items-center justify-center text-sm text-gray-500">
              Nessun dato storico disponibile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}