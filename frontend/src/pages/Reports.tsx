import { IconFileText, IconDownload, IconChartBar, IconClock } from '@tabler/icons-react';

export default function Reports() {
  const reports = [
    { id: 1, name: 'System Performance Weekly', date: '2024-04-20', type: 'PDF', size: '2.4 MB' },
    { id: 2, name: 'Task Efficiency Matrix', date: '2024-04-18', type: 'CSV', size: '1.1 MB' },
    { id: 3, name: 'Resource Utilization Audit', date: '2024-04-15', type: 'PDF', size: '3.7 MB' },
    { id: 4, name: 'ML Model Drift Report', date: '2024-04-12', type: 'PDF', size: '1.8 MB' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <IconFileText className="text-primary-500" />
          System Reports
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Download and manage generated system performance and audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStat title="Total Reports" value="128" icon={IconFileText} color="blue" />
        <ReportStat title="Downloads" value="1,024" icon={IconDownload} color="emerald" />
        <ReportStat title="Storage Used" value="482 MB" icon={IconChartBar} color="purple" />
        <ReportStat title="Last Sync" value="2m ago" icon={IconClock} color="amber" />
      </div>

      <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Report Name</th>
              <th className="px-6 py-4">Generated Date</th>
              <th className="px-6 py-4">Format</th>
              <th className="px-6 py-4">Size</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                      <IconFileText className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{report.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{report.date}</td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                    {report.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{report.size}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors">
                    <IconDownload className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportStat({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  };

  return (
    <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{value}</h3>
        </div>
      </div>
    </div>
  );
}
