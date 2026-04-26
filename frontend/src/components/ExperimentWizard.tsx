import { useState, useEffect } from 'react';
import { 
  IconX, 
  IconChevronRight, 
  IconChevronLeft, 
  IconFlask, 
  IconBrain, 
  IconServer, 
  IconRocket,
  IconCheck,
  IconInfoCircle
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { GaugeChart } from './charts/ChartAnalytics';

interface ExperimentWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALGORITHMS = [
  { id: 'iaco', name: 'Improved ACO', desc: 'Optimized ant colony for fog networks.', icon: <IconBrain className="w-6 h-6" />, complexity: 'High' },
  { id: 'ipso', name: 'Improved PSO', desc: 'Particle swarm with inertia weighting.', icon: <IconRocket className="w-6 h-6" />, complexity: 'Medium' },
  { id: 'heuristic', name: 'Round Robin', desc: 'Traditional static load balancing.', icon: <IconServer className="w-6 h-6" />, complexity: 'Low' },
];

const RESOURCES = [
  { id: 'cloud-1', name: 'Cloud Central (US-East)', type: 'Cloud', health: 98 },
  { id: 'edge-1', name: 'Edge Gateway #4', type: 'Edge', health: 85 },
  { id: 'iot-1', name: 'Smart Factory Sensor Cluster', type: 'IoT', health: 92 },
];

export default function ExperimentWizard({ isOpen, onClose }: ExperimentWizardProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    algo: '',
    parameters: {
      iterations: 100,
      population: 50,
      alpha: 0.5,
      beta: 0.5
    },
    resources: [] as string[]
  });

  const [successProb, setSuccessProb] = useState(75);

  useEffect(() => {
    // Dynamic success probability calculation (simulated)
    let prob = 60;
    if (config.algo === 'iaco') prob += 15;
    if (config.algo === 'ipso') prob += 10;
    if (config.resources.length > 2) prob += 10;
    if (config.parameters.iterations > 150) prob -= 5;
    setSuccessProb(Math.min(99, Math.max(10, prob)));
  }, [config]);

  if (!isOpen) return null;

  const nextStep = () => setStep(s => Math.min(4, s + 1));
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col md:flex-row animate-scale-in">
        
        {/* Sidebar / Progress */}
        <div className="w-full md:w-64 bg-gray-50 dark:bg-gray-900/50 p-8 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
              <IconFlask className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black dark:text-white uppercase tracking-tight">Experiment Wizard</h2>
          </div>

          <div className="space-y-6">
            <ProgressStep num={1} label="Algorithm" active={step === 1} done={step > 1} />
            <ProgressStep num={2} label="Variables" active={step === 2} done={step > 2} />
            <ProgressStep num={3} label="Resources" active={step === 3} done={step > 3} />
            <ProgressStep num={4} label="Launch" active={step === 4} done={step > 4} />
          </div>

          <div className="mt-20 pt-8 border-t border-gray-100 dark:border-gray-800 hidden md:block">
             <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-800/50">
                <div className="flex items-center gap-2 mb-2">
                   <IconInfoCircle className="w-4 h-4 text-primary-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400">Insight</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                   IACO algorithms perform best in high-latency fog clusters.
                </p>
             </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-[500px]">
          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            
            {step === 1 && (
              <div className="animate-fade-in">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Choose Algorithm</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Select the core scheduling logic for your experiment.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ALGORITHMS.map(algo => (
                    <button 
                      key={algo.id}
                      onClick={() => setConfig({...config, algo: algo.id})}
                      className={clsx(
                        "p-6 rounded-3xl border text-left transition-all group",
                        config.algo === algo.id 
                          ? "border-primary-500 bg-primary-50/30 dark:bg-primary-900/10 ring-4 ring-primary-500/10" 
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-gray-900/50"
                      )}
                    >
                      <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", config.algo === algo.id ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500")}>
                        {algo.icon}
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">{algo.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{algo.desc}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-lg">
                        Complexity: {algo.complexity}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Configure Variables</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Fine-tune the model parameters for optimal scheduling.</p>
                <div className="space-y-8 max-w-lg">
                   <ParameterControl 
                     label="Max Iterations" 
                     value={config.parameters.iterations} 
                     min={10} max={500}
                     onChange={(v) => setConfig({...config, parameters: {...config.parameters, iterations: v}})}
                   />
                   <ParameterControl 
                     label="Population Size" 
                     value={config.parameters.population} 
                     min={10} max={200}
                     onChange={(v) => setConfig({...config, parameters: {...config.parameters, population: v}})}
                   />
                   <div className="grid grid-cols-2 gap-8">
                      <ParameterControl 
                        label="Alpha (Exploration)" 
                        value={config.parameters.alpha} 
                        step={0.1} min={0} max={1}
                        onChange={(v) => setConfig({...config, parameters: {...config.parameters, alpha: v}})}
                      />
                      <ParameterControl 
                        label="Beta (Exploitation)" 
                        value={config.parameters.beta} 
                        step={0.1} min={0} max={1}
                        onChange={(v) => setConfig({...config, parameters: {...config.parameters, beta: v}})}
                      />
                   </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Target Resources</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Select which network clusters will host this experiment.</p>
                <div className="space-y-3">
                   {RESOURCES.map(res => (
                     <button 
                       key={res.id}
                       onClick={() => {
                         const exists = config.resources.includes(res.id);
                         setConfig({
                           ...config, 
                           resources: exists 
                             ? config.resources.filter(id => id !== res.id)
                             : [...config.resources, res.id]
                         });
                       }}
                       className={clsx(
                         "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all",
                         config.resources.includes(res.id)
                          ? "border-primary-500 bg-primary-50/30 dark:bg-primary-900/10"
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                       )}
                     >
                       <div className={clsx("w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors", config.resources.includes(res.id) ? "bg-primary-600 border-primary-600 text-white" : "border-gray-300 dark:border-gray-700")}>
                         {config.resources.includes(res.id) && <IconCheck className="w-3.5 h-3.5" stroke={4} />}
                       </div>
                       <div className="flex-1 text-left">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{res.name}</h4>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{res.type}</span>
                       </div>
                       <div className="text-right">
                          <span className={clsx("text-xs font-black px-2 py-1 rounded-lg", res.health > 90 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>
                            {res.health}% Health
                          </span>
                       </div>
                     </button>
                   ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-in flex flex-col items-center text-center py-10">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Ready to Launch?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md">The ML engine has analyzed your configuration and predicted the following success rate.</p>
                
                <div className="w-64 h-44 mb-8">
                   <GaugeChart value={successProb} label="Success Prob." color={successProb > 80 ? 'green' : successProb > 60 ? 'blue' : 'amber'} />
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
                   <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Algorithm</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white uppercase">{config.algo}</span>
                   </div>
                   <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Resources</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{config.resources.length} Clusters</span>
                   </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer Controls */}
          <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between">
            <button 
              onClick={onClose}
              className="text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
               {step > 1 && (
                 <button 
                    onClick={prevStep}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-all"
                 >
                    <IconChevronLeft className="w-4 h-4" /> Back
                 </button>
               )}
               {step < 4 ? (
                 <button 
                    onClick={nextStep}
                    disabled={step === 1 && !config.algo}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-primary-500/25 transition-all"
                 >
                    Continue <IconChevronRight className="w-4 h-4" />
                 </button>
               ) : (
                 <button 
                    onClick={onClose}
                    className="flex items-center gap-2 px-10 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all"
                 >
                    <IconRocket className="w-4 h-4" /> Launch Experiment
                 </button>
               )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-[110]"
        >
          <IconX className="w-6 h-6" />
        </button>

      </div>
    </div>
  );
}

function ProgressStep({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className={clsx(
        "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all",
        active ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" : 
        done ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
        "bg-gray-100 dark:bg-gray-800 text-gray-400"
      )}>
        {done ? <IconCheck className="w-4 h-4" /> : num}
      </div>
      <span className={clsx(
        "text-xs font-black uppercase tracking-widest",
        active ? "text-gray-900 dark:text-white" : "text-gray-400"
      )}>
        {label}
      </span>
    </div>
  );
}

function ParameterControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
       <div className="flex justify-between items-center px-1">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</label>
          <span className="text-sm font-black text-primary-600 dark:text-primary-400">{value}</span>
       </div>
       <input 
          type="range" 
          min={min} max={max} step={step} 
          value={value} 
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary-600"
       />
    </div>
  );
}
