import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { 
  IconFlame, 
  IconBolt, 
  IconShield, 
  IconActivity, 
  IconAlertTriangle, 
  IconRefresh,
  IconPlayerStop,
  IconPlayerPlay,
  IconClock,
  IconBug,
  IconWifiOff
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useToast } from '../contexts/ToastContext';

const services = [
  { id: 'database', name: 'PostgreSQL Database', icon: IconActivity, color: 'blue' },
  { id: 'redis', name: 'Redis Cache', icon: IconBolt, color: 'red' },
  { id: 'ml-service', name: 'AI Prediction Service', icon: IconActivity, color: 'purple' },
  { id: 'email', name: 'SMTP Gateway', icon: IconActivity, color: 'amber' },
];

const failureTypes = [
  { id: 'latency', name: 'Latency Injection', icon: IconClock, description: 'Inject artificial delay into service calls', unit: 'ms', defaultValue: 500 },
  { id: 'error', name: 'Fault Injection', icon: IconBug, description: 'Simulate random 500 errors', unit: '%', defaultValue: 10 },
  { id: 'outage', name: 'Service Outage', icon: IconWifiOff, description: 'Complete service shutdown (trips circuit breaker)', unit: '', defaultValue: 1 },
];

export default function ChaosConsole() {
  const { chaosExperiments, chaosLoading, fetchChaosData, startChaosExperiment, stopChaosExperiment } = useStore();
  const toast = useToast();
  const [selectedService, setSelectedService] = useState(services[0].id);
  const [selectedType, setSelectedType] = useState(failureTypes[0].id);
  const [value, setValue] = useState(500);

  useEffect(() => {
    fetchChaosData();
    const interval = setInterval(fetchChaosData, 5000);
    return () => clearInterval(interval);
  }, [fetchChaosData]);

  const handleStart = async () => {
    try {
      await startChaosExperiment({
        service: selectedService,
        type: selectedType,
        value: selectedType === 'outage' ? 1 : value
      });
      toast.warning('Chaos Initiated', `Fault injected into ${selectedService}`);
    } catch (err) {
      toast.error('Failed to trigger chaos', 'Check your permissions');
    }
  };

  const handleStop = async (service: string, type: string) => {
    try {
      await stopChaosExperiment({ service, type });
      toast.success('System Restored', `Fault removed from ${service}`);
    } catch (err) {
      toast.error('Failed to restore system');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconFlame className="text-red-500 animate-pulse" />
            Chaos Engineering Console
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Test system resilience by injecting controlled failures and monitoring recovery.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Active Testing Mode
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <IconShield className="text-primary-500" />
              Fault Injector
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight block mb-2">Target Service</label>
                <div className="grid grid-cols-2 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s.id)}
                      className={clsx(
                        "p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-2",
                        selectedService === s.id 
                          ? "bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400"
                          : "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                      )}
                    >
                      <s.icon className="w-5 h-5" />
                      {s.id.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight block mb-2">Failure Type</label>
                <div className="space-y-2">
                  {failureTypes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedType(t.id);
                        if (t.id === 'latency') setValue(500);
                        if (t.id === 'error') setValue(10);
                      }}
                      className={clsx(
                        "w-full p-4 rounded-xl border text-left transition-all group",
                        selectedType === t.id 
                          ? "bg-primary-50 dark:bg-primary-500/10 border-primary-500"
                          : "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "p-2 rounded-lg",
                          selectedType === t.id ? "bg-primary-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500 group-hover:bg-primary-500 group-hover:text-white transition-colors"
                        )}>
                          <t.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={clsx("text-sm font-bold", selectedType === t.id ? "text-primary-600 dark:text-primary-400" : "text-gray-700 dark:text-gray-300")}>
                            {t.name}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{t.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedType !== 'outage' && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight block mb-2">
                    Intensity ({value}{failureTypes.find(t => t.id === selectedType)?.unit})
                  </label>
                  <input 
                    type="range" 
                    min={selectedType === 'latency' ? 100 : 1}
                    max={selectedType === 'latency' ? 5000 : 100}
                    step={selectedType === 'latency' ? 100 : 5}
                    value={value}
                    onChange={(e) => setValue(parseInt(e.target.value))}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>Low</span>
                    <span>Critical</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={chaosExperiments.some(e => e.service === selectedService && e.type === selectedType)}
                className={clsx(
                  "w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all",
                  chaosExperiments.some(e => e.service === selectedService && e.type === selectedType)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700 shadow-red-500/20 active:scale-95"
                )}
              >
                <IconPlayerPlay className="w-5 h-5" />
                Inject Fault
              </button>
            </div>
          </div>
        </div>

        {/* Monitoring Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Experiments */}
          <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <IconAlertTriangle className="text-amber-500" />
                Active Experiments
              </h2>
              <button onClick={fetchChaosData} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <IconRefresh className={clsx("w-4 h-4 text-gray-500", chaosLoading && "animate-spin")} />
              </button>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {chaosExperiments.length > 0 ? (
                chaosExperiments.map((exp) => (
                  <div key={`${exp.service}:${exp.type}`} className="p-6 flex items-center justify-between hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                        {exp.type === 'latency' ? <IconClock /> : exp.type === 'error' ? <IconBug /> : <IconWifiOff />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-white capitalize">{exp.service.replace('-', ' ')}</p>
                          <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 px-2 py-0.5 rounded">
                            {exp.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {exp.type === 'latency' ? `Adding ${exp.value}ms delay` : 
                           exp.type === 'error' ? `Injecting ${exp.value}% failure rate` : 
                           'Full service blackout'}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleStop(exp.service, exp.type)}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:border-red-500 hover:text-red-500 transition-all shadow-sm"
                    >
                      <IconPlayerStop className="w-4 h-4" />
                      Abort
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                    <IconShield className="w-8 h-8" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-bold">System Integrity Secure</p>
                  <p className="text-sm text-gray-500 mt-1">No active chaos experiments detected.</p>
                </div>
              )}
            </div>
          </div>

          {/* Impact Timeline */}
          <div className="bg-white dark:bg-[#1a2234] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <IconActivity className="text-emerald-500" />
              Real-time Impact Assessment
            </h2>
            
            <div className="space-y-4">
              <ImpactRow label="Request Latency (P99)" normal="42ms" degraded="---" status="stable" />
              <ImpactRow label="System Error Rate" normal="0.01%" degraded="---" status="stable" />
              <ImpactRow label="CPU Utilization" normal="12%" degraded="---" status="stable" />
              <ImpactRow label="Database Connection Pool" normal="8/50" degraded="---" status="stable" />
            </div>

            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="flex gap-3">
                <IconAlertTriangle className="w-5 h-5 text-gray-400 shrink-0" />
                <p className="text-[11px] text-gray-500 italic">
                  Note: Experiments are transient and will automatically clear on service restart. Use with caution in production-mirrored environments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactRow({ label, normal, degraded, status }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Normal</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{normal}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Current</p>
          <p className={clsx("text-sm font-bold", status === 'stable' ? "text-emerald-500" : "text-red-500")}>
            {status === 'stable' ? normal : degraded}
          </p>
        </div>
      </div>
    </div>
  );
}
