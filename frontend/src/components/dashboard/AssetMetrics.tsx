import React from 'react';

interface AssetMetricsProps {
  totals: {
    assets: number;
    tickets: number;
    interventions: number;
  } | null;
}

export default function AssetMetrics({ totals }: AssetMetricsProps) {
  // Se non ci sono dati, mostriamo 0 di default
  const data = totals || { assets: 0, tickets: 0, interventions: 0 };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
      {/* Card 1: Totale Asset */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-title-md font-bold text-black dark:text-white">
              {data.assets}
            </h4>
            <span className="text-sm font-medium">Asset Censiti</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            {/* Icona Box */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card 2: Segnalazioni / Ticket */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-title-md font-bold text-black dark:text-white">
              {data.tickets}
            </h4>
            <span className="text-sm font-medium">Segnalazioni Attive</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning">
            {/* Icona Alert */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card 3: Interventi */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-title-md font-bold text-black dark:text-white">
              {data.interventions}
            </h4>
            <span className="text-sm font-medium">Interventi Completati</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
            {/* Icona Wrench/Tool */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}