import { useState } from 'react';
import { 
  IconSearch, 
  IconHelpCircle,
  IconChevronDown,
  IconChevronRight,
  IconBrandGoogle,
  IconBrandTwitter,
  IconShieldCheck, 
  IconMessages, 
  IconCpu, 
  IconLock,
  IconRotate,
  IconServer,
  IconChartBar
} from '@tabler/icons-react';
import { clsx } from 'clsx';

const FAQ_CATEGORIES = [
  { id: 'access', icon: IconShieldCheck, label: 'Access Control' },
  { id: 'collab', icon: IconMessages, label: 'Collaboration' },
  { id: 'scheduling', icon: IconCpu, label: 'Scheduling' },
  { id: 'infra', icon: IconServer, label: 'Infrastructure' },
  { id: 'analytics', icon: IconChartBar, label: 'Analytics' },
  { id: 'security', icon: IconLock, label: 'Security' },
];

const FAQS = [
  { 
    category: 'access', 
    questions: [
      { q: 'How are Permissions assigned?', a: 'Permissions are grouped into three tiers: Basic, Professional, and Business. Each tier grants different levels of CRUD access to tasks, resources, and system logs. Administrators can override these via the Roles menu.' },
      { q: 'What are the predefined roles?', a: 'The system includes five predefined roles: Administrator (Full access), Editor (Can manage tasks), Author (Can create tasks), Maintainer (Node management), and Subscriber (View-only).' },
      { q: 'Can I create custom roles?', a: 'Currently, roles are predefined to ensure system stability. However, you can adjust the permissions assigned to each role tier in the Permissions management module.' }
    ]
  },
  {
    category: 'collab',
    questions: [
      { q: 'How do I use the Chat module?', a: 'The Chat app allows real-time communication between administrators and node operators. You can share task logs and coordinate scheduling decisions directly within the platform.' },
      { q: 'Can I track Email interactions?', a: 'Yes, the Email module integrates your external communications with the scheduler, allowing you to trigger tasks via incoming support tickets or client requests.' },
      { q: 'How do I manage the Kanban board?', a: 'The Kanban board is synchronized with the global task queue. Moving a card to "Done" automatically updates the task status in the database and notifies the scheduler.' }
    ]
  },
  {
    category: 'scheduling',
    questions: [
      { q: 'What algorithm does the scheduler use?', a: 'The platform utilizes a Neural Hybrid Heuristic (HH) algorithm that combines Improved Particle Swarm Optimization (IPSO) for global search and Improved Ant Colony Optimization (IACO) for local refinement.' },
      { q: 'How does Fog Computing reduce latency?', a: 'By offloading tasks to local Fog nodes instead of a centralized Cloud server, we minimize network propagation delay and energy consumption.' },
      { q: 'What is the IPSO Strategy?', a: 'Improved Particle Swarm Optimization uses an adaptive inertia weight with a contraction factor for fast convergence, making it ideal for broad exploration of the solution space.' },
      { q: 'What is the IACO Strategy?', a: 'Improved Ant Colony Optimization uses a regulatory factor for path selection and pheromone updates, providing high-precision local search for optimal allocation.' }
    ]
  },
  {
    category: 'infra',
    questions: [
      { q: 'What are Fog Nodes?', a: 'Fog nodes are intermediate processing units located between the cloud and the end-users. They provide local compute and storage to reduce latency.' },
      { q: 'How are Devices discovered?', a: 'The system uses an automated discovery protocol that scans the local network for compatible IoT and terminal devices, registering them as available resources.' }
    ]
  },
  {
    category: 'analytics',
    questions: [
      { q: 'How is Reliability Score calculated?', a: 'Reliability is a composite metric derived from task completion rate, node uptime, and prediction accuracy of the ML model.' },
      { q: 'Can I export performance data?', a: 'Yes, all analytics views include an "Export" button to download data in CSV or JSON format for external analysis.' }
    ]
  },
  {
    category: 'security',
    questions: [
      { q: 'Where can I see system transactions?', a: 'All scheduling decisions are recorded in the Transactions ledger on the main Dashboard and in the detailed audit logs accessible via the Analytics page.' },
      { q: 'Is the ML model secure?', a: 'Yes, the ML service runs in a containerized environment (ml-service) and communicates via an authenticated internal API. No raw data leaves your infrastructure.' }
    ]
  }
];

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState('access');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const currentFaqs = FAQS.find(f => f.category === activeCategory)?.questions || [];

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in">
      
      {/* ── SEARCH HEADER ── */}
      <div className="relative h-[280px] rounded-3xl overflow-hidden mb-12 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-primary-600 to-indigo-700">
         <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent opacity-30" />
         </div>
         
         <h1 className="text-3xl font-bold text-white mb-2">Hello, how can we help?</h1>
         <p className="text-primary-100 mb-8 text-center max-w-lg">or choose a category to quickly find the help you need</p>
         
         <div className="relative w-full max-w-2xl">
            <IconSearch className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
               type="text" 
               placeholder="Ask a question..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-14 pr-6 py-4 bg-white dark:bg-[#1a2234] rounded-2xl shadow-xl outline-none focus:ring-4 focus:ring-primary-500/20 text-gray-900 dark:text-white"
            />
         </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
         
         {/* ── SIDEBAR ── */}
         <div className="col-span-12 lg:col-span-3">
            <div className="space-y-2">
               {FAQ_CATEGORIES.map(cat => (
                  <button 
                     key={cat.id}
                     onClick={() => setActiveCategory(cat.id)}
                     className={clsx(
                        "w-full flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-bold transition-all",
                        activeCategory === cat.id 
                           ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" 
                           : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                     )}
                  >
                     <cat.icon className="w-5 h-5" />
                     {cat.label}
                  </button>
               ))}
            </div>
            
            <div className="mt-12 bg-white dark:bg-[#1a2234] rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
               <h4 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Support</h4>
               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center">
                        <IconHelpCircle className="w-6 h-6" />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Email Us</p>
                        <p className="text-xs text-gray-500">24/7 Support Team</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                        <IconRotate className="w-6 h-6" />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Live Chat</p>
                        <p className="text-xs text-gray-500">Average response: 2m</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* ── QUESTIONS ── */}
         <div className="col-span-12 lg:col-span-9">
            <div className="flex items-center gap-3 mb-8">
               <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                  <IconHelpCircle className="w-6 h-6 text-primary-600" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white capitalize">{activeCategory}</h3>
                  <p className="text-sm text-gray-500">Common questions about {activeCategory}</p>
               </div>
            </div>

            <div className="space-y-4">
               {currentFaqs.map((faq, idx) => (
                  <div key={idx} className="bg-white dark:bg-[#1a2234] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                     <button 
                        onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                     >
                        <span className="text-base font-bold text-gray-900 dark:text-white">{faq.q}</span>
                        {expandedIndex === idx ? <IconChevronDown className="w-5 h-5 text-gray-400" /> : <IconChevronRight className="w-5 h-5 text-gray-400" />}
                     </button>
                     {expandedIndex === idx && (
                        <div className="px-6 pb-6 animate-fade-in">
                           <div className="w-full h-px bg-gray-100 dark:bg-gray-800 mb-4" />
                           <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                              {faq.a}
                           </p>
                        </div>
                     )}
                  </div>
               ))}
               {currentFaqs.length === 0 && <p className="text-center text-gray-400 py-20">No FAQs found for this category.</p>}
            </div>
         </div>

      </div>

      {/* ── STILL HAVE QUESTIONS ── */}
      <div className="mt-20 text-center space-y-4 mb-20">
         <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 text-xs font-bold rounded-full uppercase tracking-widest">
            Need more help?
         </div>
         <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Still have questions?</h2>
         <p className="text-gray-500 max-w-xl mx-auto">If you cannot find a question in our FAQ, you can always contact us. We will answer to you shortly!</p>
         
         <div className="flex flex-wrap justify-center gap-6 pt-8">
            <ContactCard icon={IconBrandGoogle} label="Email Support" value="support@example.com" />
            <ContactCard icon={IconBrandTwitter} label="Twitter / X" value="@scheduler_ai" />
         </div>
      </div>

    </div>
  );
}

function ContactCard({ icon: Icon, label, value }: any) {
   return (
      <div className="bg-white dark:bg-[#1a2234] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm w-full max-w-[300px] group hover:border-primary-500/50 transition-all">
         <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <Icon className="w-8 h-8 text-primary-600" />
         </div>
         <h4 className="text-lg font-bold text-gray-900 dark:text-white">{label}</h4>
         <p className="text-sm text-primary-600 font-medium">{value}</p>
      </div>
   );
}
