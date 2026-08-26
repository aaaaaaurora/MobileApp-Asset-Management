import React from 'react';

interface LogEntry {
  id: string;
  action: string;
  service_name: string;
  created_at: string;
}

interface RecentLogsProps {
  logs: LogEntry[] | null;
}

// Funzione di utilità per tradurre le azioni in italiano
const translateAction = (action: string) => {
  const map: Record<string, string> = {
    'ASSET_CREATED': 'Creazione Asset',
    'ASSET_UPDATED': 'Aggiornamento Asset',
    'CREATE_WARNING': 'Apertura Segnalazione',
    'RESOLVE_WARNING': 'Risoluzione Segnalazione',
    'LOG_MAINTENANCE': 'Intervento Manutenzione',
  };
  return map[action] || action;
};

export default function RecentLogsTable({ logs }: RecentLogsProps) {
  return (
    <div className="rounded-xl border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <h4 className="mb-6 text-xl font-bold text-black dark:text-white">
        Attività di Sistema Recenti
      </h4>

      <div className="flex flex-col">
        <div className="grid grid-cols-3 rounded-sm bg-gray-2 dark:bg-meta-4 sm:grid-cols-4">
          <div className="p-2.5 xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Azione</h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Servizio</h5>
          </div>
          <div className="hidden p-2.5 text-center sm:block xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Data e Ora</h5>
          </div>
          <div className="p-2.5 text-center xl:p-5">
            <h5 className="text-sm font-medium uppercase xsm:text-base">Stato</h5>
          </div>
        </div>

        {logs && logs.length > 0 ? (
          logs.map((log, key) => (
            <div
              className={`grid grid-cols-3 sm:grid-cols-4 ${
                key === logs.length - 1 ? '' : 'border-b border-stroke dark:border-strokedark'
              }`}
              key={log.id}
            >
              <div className="flex items-center p-2.5 xl:p-5">
                <p className="text-black dark:text-white">{translateAction(log.action)}</p>
              </div>
              <div className="flex items-center justify-center p-2.5 xl:p-5">
                <p className="text-meta-3">{log.service_name}</p>
              </div>
              <div className="hidden items-center justify-center p-2.5 sm:flex xl:p-5">
                <p className="text-black dark:text-white">
                  {new Date(log.created_at).toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex items-center justify-center p-2.5 xl:p-5">
                <p className="text-success font-bold">Completato</p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-5 text-center text-sm text-gray-500">Nessuna attività recente registrata.</div>
        )}
      </div>
    </div>
  );
}