import { useParams, Link } from 'react-router-dom';
import { 
  IconArrowLeft, 
  IconCpu, 
  IconSettings, 
  IconBolt, 
  IconInfoCircle,
  IconChartBar,
  IconCode
} from '@tabler/icons-react';

const STRATEGIES = {
  ipso: {
    title: 'IPSO Strategy',
    subtitle: 'Global Optimization',
    description: 'Improved Particle Swarm Optimization (IPSO) is a population-based stochastic optimization technique inspired by social behavior of bird flocking.',
    fullContent: `
      Improved Particle Swarm Optimization (IPSO) enhances the traditional PSO by introducing adaptive inertia weight and contraction factors. This prevents the particles from getting trapped in local optima during early iterations.

      ### How it works:
      1. **Initialization**: A population of particles is initialized with random positions and velocities.
      2. **Velocity Update**: Each particle updates its velocity based on its own best position (pBest) and the global best position (gBest).
      3. **Position Update**: Particles move to new positions based on their updated velocities.
      4. **Adaptive Weighting**: Unlike standard PSO, IPSO dynamically adjusts the inertia weight (w) as iterations progress, allowing for broad exploration initially and fine-tuned exploitation near the end.

      ### Key Formula:
      v[i+1] = w * v[i] + c1 * r1 * (pBest[i] - x[i]) + c2 * r2 * (gBest - x[i])
    `,
    features: ['Fast convergence', 'Global search capability', 'Low computational overhead', 'Self-organizing behavior'],
    icon: IconCpu,
    color: 'indigo'
  },
  iaco: {
    title: 'IACO Strategy',
    subtitle: 'Local Refinement',
    description: 'Improved Ant Colony Optimization (IACO) simulates the behavior of ants finding the shortest path to food using pheromone trails.',
    fullContent: `
      Improved Ant Colony Optimization (IACO) focuses on local refinement and high-precision path selection. It introduces a regulatory factor that prevents pheromone saturation on specific paths, ensuring that the algorithm explores a diverse set of solutions.

      ### How it works:
      1. **Pheromone Initialization**: Initial pheromone levels are set on all possible paths.
      2. **Path Selection**: Ants choose paths based on pheromone concentration and heuristic desirability.
      3. **Regulatory Factor**: IACO uses a dynamic evaporation rate to prevent premature convergence.
      4. **Local Search**: Once an ant finds a solution, a local search is performed to further optimize the result.

      ### Key Advantage:
      IACO is particularly effective at finding high-precision solutions in complex, multi-modal search spaces where standard heuristics fail.
    `,
    features: ['High precision', 'Robustness', 'Local optimization', 'Distributed search'],
    icon: IconSettings,
    color: 'cyan'
  },
  hybrid: {
    title: 'Hybrid Heuristic (HH)',
    subtitle: 'Best of Both Worlds',
    description: 'The HH algorithm combines the strengths of IPSO and IACO to provide a superior scheduling solution for fog computing environments.',
    fullContent: `
      The Hybrid Heuristic (HH) strategy is a two-phase optimization process. In the first phase, IPSO is used to rapidly scan the solution space and identify high-potential regions. In the second phase, IACO is deployed within these regions to refine the solution and find the global optimum with maximum precision.

      ### The Hybrid Workflow:
      1. **Phase 1 (IPSO)**: Fast global exploration. Identifies the "valleys" in the optimization landscape.
      2. **Phase 2 (IACO)**: Deep local exploitation. Finds the absolute bottom of the identified valley.
      
      ### Results:
      - **Reduced Latency**: Faster task allocation than IACO alone.
      - **Higher Reliability**: More robust solutions than IPSO alone.
      - **Energy Savings**: Optimized node selection reduces the overall power footprint of the fog network.
    `,
    features: ['Superior efficiency', 'Balanced exploration/exploitation', 'Adaptive resource scaling', 'Maximized throughput'],
    icon: IconBolt,
    color: 'purple'
  }
};

export default function AlgorithmDetails() {
  const { strategyId } = useParams();
  const strategy = STRATEGIES[strategyId as keyof typeof STRATEGIES] || STRATEGIES.ipso;

  const Icon = strategy.icon;

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-in">
      
      <Link to="/fog-computing" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-primary-600 mb-8 transition-colors">
        <IconArrowLeft className="w-4 h-4" /> Back to Fog Computing
      </Link>

      <div className="bg-white dark:bg-[#1a2234] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
        {/* Hero Section */}
        <div className={`p-8 md:p-12 bg-gradient-to-br ${
          strategyId === 'ipso' ? 'from-indigo-600 to-blue-700' : 
          strategyId === 'iaco' ? 'from-cyan-600 to-blue-700' : 
          'from-purple-600 to-indigo-700'
        } text-white`}>
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Icon className="w-16 h-16" stroke={1.5} />
            </div>
            <div>
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest">{strategy.subtitle}</span>
              <h1 className="text-4xl md:text-5xl font-black mt-4">{strategy.title}</h1>
              <p className="text-white/80 text-lg mt-4 max-w-2xl leading-relaxed">
                {strategy.description}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              <div className="prose dark:prose-invert max-w-none">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <IconInfoCircle className="w-6 h-6 text-primary-500" /> Technical Overview
                </h2>
                <div className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line text-lg">
                  {strategy.fullContent}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                   <IconCode className="w-5 h-5 text-gray-400" /> Pseudocode Logic
                </h3>
                <div className="font-mono text-sm text-gray-500 dark:text-gray-400 space-y-2">
                  <p className="text-blue-500">// Step 1: Search solution space</p>
                  <p>initialize_population()</p>
                  <p>while iteration &lt; max_iterations:</p>
                  <p className="pl-4">update_parameters()</p>
                  <p className="pl-4">calculate_fitness()</p>
                  <p className="pl-4">update_best_solutions()</p>
                  <p className="text-blue-500">// Step 2: Return optimized mapping</p>
                  <p>return global_best</p>
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Key Performance</h3>
                <div className="space-y-6">
                   <MetricBar label="Search Speed" value={strategyId === 'ipso' ? 95 : strategyId === 'iaco' ? 70 : 90} />
                   <MetricBar label="Precision" value={strategyId === 'ipso' ? 65 : strategyId === 'iaco' ? 98 : 96} />
                   <MetricBar label="Robustness" value={strategyId === 'ipso' ? 75 : strategyId === 'iaco' ? 80 : 98} />
                   <MetricBar label="Energy Savings" value={strategyId === 'ipso' ? 70 : strategyId === 'iaco' ? 85 : 92} />
                </div>
              </div>

              <div className="bg-primary-50 dark:bg-primary-900/10 rounded-2xl p-6 border border-primary-100 dark:border-primary-900/30">
                <h3 className="text-lg font-bold text-primary-900 dark:text-primary-100 mb-4 flex items-center gap-3">
                  <IconChartBar className="w-5 h-5" /> Highlights
                </h3>
                <ul className="space-y-3">
                  {strategy.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-primary-700 dark:text-primary-300">
                       <IconBolt className="w-4 h-4 mt-0.5 shrink-0" />
                       {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value }: { label: string, value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary-500 rounded-full transition-all duration-1000" 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
