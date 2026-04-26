import { useState } from 'react';
import { 
  IconUser, 
  IconLock, 
  IconBookmark, 
  IconBell, 
  IconLink,
  IconUpload,
  IconAlertTriangle,
  IconCheck,
  IconBrandGoogle,
  IconBrandGithub,
  IconBrandSlack,
  IconTrash,
  IconPlus,
  IconCreditCard,
  IconChevronRight,
  IconShieldLock,
  IconCode,
  IconKey,
  IconWebhook,
  IconCopy,
  IconEye,
  IconDotsVertical
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { authApi } from '../lib/api';
import { clsx } from 'clsx';
import ProgressBar from '../components/shared/ProgressBar';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  phone: string;
  address: string;
  state: string;
  zipCode: string;
  country: string;
  language: string;
  timezone: string;
  currency: string;
}

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>({
    firstName: user?.name ? user.name.split(' ')[0] : '',
    lastName: user?.name ? user.name.split(' ').slice(1).join(' ') : '',
    email: user?.email || '',
    organization: 'Pixinvent',
    phone: '+1 (917) 543-9876',
    address: '123 Main St, New York, NY 10001',
    state: 'New York',
    zipCode: '10001',
    country: 'USA',
    language: 'English',
    timezone: '(GMT-11:00) International Date Line West',
    currency: 'USD',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authApi.updateProfile({
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        email: profile.email,
      });
      toast.success('Profile updated', 'Your account details have been saved successfully.');
    } catch (error) {
      toast.error('Failed to save', 'Could not update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      
      {/* ── TABS ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={IconUser} label="Account" />
        <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={IconLock} label="Security" />
        <TabButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} icon={IconBookmark} label="Billing & Plans" />
        <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} icon={IconBell} label="Notifications" />
        <TabButton active={activeTab === 'connections'} onClick={() => setActiveTab('connections')} icon={IconLink} label="Connections" />
        <TabButton active={activeTab === 'developer'} onClick={() => setActiveTab('developer')} icon={IconCode} label="Developer" />
      </div>

      <div className="animate-fade-in-up">
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Details</h3>
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                    {user?.picture ? (
                      <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-primary-500">
                        {profile.firstName.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex gap-3 mb-2">
                      <button className="btn btn-primary flex items-center gap-2 px-5 py-2.5">
                        <IconUpload className="w-4 h-4" stroke={1.5} />
                        Upload new photo
                      </button>
                      <button className="btn btn-secondary px-5 py-2.5 text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border-none">
                        Reset
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allowed JPG, GIF or PNG. Max size of 800K
                    </p>
                  </div>
                </div>

                <div className="w-full h-px bg-gray-200 dark:bg-gray-800 mb-8" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name</label>
                    <input type="text" value={profile.firstName} onChange={e => handleChange('firstName', e.target.value)} className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-gray-900 dark:text-white transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label>
                    <input type="text" value={profile.lastName} onChange={e => handleChange('lastName', e.target.value)} className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-gray-900 dark:text-white transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                    <input type="email" value={profile.email} onChange={e => handleChange('email', e.target.value)} className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-gray-900 dark:text-white transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Organization</label>
                    <input type="text" value={profile.organization} onChange={e => handleChange('organization', e.target.value)} className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-gray-900 dark:text-white transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone Number</label>
                    <input type="text" value={profile.phone} onChange={e => handleChange('phone', e.target.value)} className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-gray-900 dark:text-white transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address</label>
                    <input type="text" value={profile.address} onChange={e => handleChange('address', e.target.value)} className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-gray-900 dark:text-white transition-all outline-none" />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button onClick={handleSave} disabled={isSaving} className="btn btn-primary px-6 py-2.5 text-sm font-semibold">
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button className="btn btn-secondary px-6 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border-none">
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Account</h3>
              </div>
              <div className="p-6">
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded-lg p-4 mb-6 flex gap-3">
                  <IconAlertTriangle className="w-5 h-5 text-orange-600 shrink-0" stroke={1.5} />
                  <div>
                    <h4 className="text-orange-800 dark:text-orange-300 font-semibold mb-1 text-sm">Are you sure you want to delete your account?</h4>
                    <p className="text-orange-700 dark:text-orange-400 text-sm">Once you delete your account, there is no going back. Please be certain.</p>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group mb-6">
                  <input type="checkbox" checked={confirmDeactivate} onChange={(e) => setConfirmDeactivate(e.target.checked)} className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">I confirm my account deactivation</span>
                </label>
                <button disabled={!confirmDeactivate} className={clsx("btn px-6 py-2.5 text-sm font-semibold transition-all", confirmDeactivate ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 border-none" : "bg-red-500/50 text-white/70 cursor-not-allowed border-none")}>
                  Deactivate Account
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
                    <input type="password" placeholder="············" className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
                    <input type="password" placeholder="············" className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
                    <input type="password" placeholder="············" className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1a2234] border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button className="btn btn-primary px-6 py-2.5">Save changes</button>
                  <button className="btn btn-secondary px-6 py-2.5 border-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800">Reset</button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-6 flex flex-col sm:flex-row items-center gap-6">
               <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <IconShieldLock className="w-10 h-10 text-primary-600" stroke={1.5} />
               </div>
               <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Two-step verification</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Keep your account extra secure with a second authentication step.</p>
               </div>
               <button className="btn btn-primary px-6">Enable</button>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                 <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
                    <div className="flex justify-between items-start mb-6">
                       <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current Plan</h3>
                          <p className="text-sm text-gray-500">Your current subscription details.</p>
                       </div>
                       <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-600 rounded-lg text-xs font-bold uppercase tracking-wider">Enterprise</span>
                    </div>
                    <div className="space-y-4">
                       <div>
                          <div className="flex justify-between text-sm mb-1.5">
                             <span className="font-semibold text-gray-700 dark:text-gray-300">Storage Usage</span>
                             <span className="font-bold text-gray-900 dark:text-white">75.5 GB / 100 GB</span>
                          </div>
                          <ProgressBar value={75.5} color="primary" height={8} />
                       </div>
                       <div className="pt-2">
                          <button className="btn btn-primary px-6">Upgrade Plan</button>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                       <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Methods</h3>
                       <button className="btn btn-primary btn-sm flex items-center gap-1"><IconPlus className="w-4 h-4" /> Add Card</button>
                    </div>
                    <div className="p-6 space-y-4">
                       <div className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-8 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                <IconCreditCard className="w-6 h-6 text-gray-400" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Visa •••• 4242</p>
                                <p className="text-xs text-gray-500">Expiry 12/26</p>
                             </div>
                          </div>
                          <span className="text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded">Primary</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="bg-primary-600 rounded-xl p-6 text-white shadow-xl shadow-primary-500/20">
                    <h3 className="text-lg font-bold mb-1">Standard Plan</h3>
                    <p className="text-primary-100 text-sm mb-6">Ideal for growing teams.</p>
                    <div className="flex items-baseline gap-1 mb-6">
                       <span className="text-3xl font-bold">$99</span>
                       <span className="text-primary-200 text-sm">/month</span>
                    </div>
                    <ul className="space-y-3 text-sm mb-8">
                       <li className="flex items-center gap-2"><IconCheck className="w-4 h-4" /> 10 Team Members</li>
                       <li className="flex items-center gap-2"><IconCheck className="w-4 h-4" /> 500 GB Storage</li>
                       <li className="flex items-center gap-2"><IconCheck className="w-4 h-4" /> Priority Support</li>
                    </ul>
                    <button className="w-full py-2.5 bg-white text-primary-600 font-bold rounded-lg hover:bg-gray-50 transition-colors">Upgrade Plan</button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Notification Settings</h3>
              <p className="text-sm text-gray-500">Configure how you receive alerts and updates.</p>
            </div>
            <div className="p-6">
               <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-gray-800">
                       <th className="py-4">Type</th>
                       <th className="py-4 text-center">Email</th>
                       <th className="py-4 text-center">Browser</th>
                       <th className="py-4 text-center">App</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                     <NotificationRow label="New Task Assigned" />
                     <NotificationRow label="Experiment Completed" />
                     <NotificationRow label="System Alerts" />
                     <NotificationRow label="Account Security" />
                  </tbody>
               </table>
               <div className="mt-8 flex gap-3">
                  <button className="btn btn-primary px-6 py-2.5">Save Changes</button>
                  <button className="btn btn-secondary px-6 py-2.5 border-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800">Discard</button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connected Accounts</h3>
                   <p className="text-sm text-gray-500">Display content from your connected accounts.</p>
                </div>
                <div className="p-6 space-y-5">
                   <ConnectionItem icon={IconBrandGoogle} name="Google" category="Calendar and Contacts" connected />
                   <ConnectionItem icon={IconBrandSlack} name="Slack" category="Communication" />
                   <ConnectionItem icon={IconBrandGithub} name="Github" category="Manage Repositories" connected />
                </div>
             </div>

             <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Social Accounts</h3>
                   <p className="text-sm text-gray-500">Manage your social profile connections.</p>
                </div>
                <div className="p-6 space-y-5">
                   <ConnectionItem icon={IconBrandGithub} name="Twitter" category="Not Connected" />
                   <ConnectionItem icon={IconBrandGoogle} name="LinkedIn" category="Connected" connected />
                </div>
             </div>
          </div>
        )}

        {activeTab === 'developer' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* API Keys */}
            <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">API Keys</h3>
                    <p className="text-sm text-gray-500">Manage your secret keys for API access.</p>
                  </div>
                  <button className="btn btn-primary flex items-center gap-2">
                    <IconPlus className="w-4 h-4" /> Create New Key
                  </button>
               </div>
               <div className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl gap-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600">
                           <IconKey className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-gray-900 dark:text-white">Main Research Key</p>
                           <p className="text-xs text-gray-500 font-mono">sk_test_••••••••••••••••••••3a2f</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-primary-500 transition-colors"><IconCopy className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-primary-500 transition-colors"><IconEye className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-red-500 transition-colors"><IconTrash className="w-4 h-4" /></button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Webhooks */}
            <div className="bg-white dark:bg-[#1a2234] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <IconWebhook className="w-5 h-5 text-primary-600" />
                      Webhooks
                    </h3>
                    <p className="text-sm text-gray-500">Receive real-time events on your server.</p>
                  </div>
                  <button className="btn btn-primary flex items-center gap-2">
                    <IconPlus className="w-4 h-4" /> Add Endpoint
                  </button>
               </div>
               <div className="p-6">
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                           <tr className="border-b border-gray-100 dark:border-gray-800">
                              <th className="px-6 py-3 font-bold text-gray-600 dark:text-gray-400">Endpoint</th>
                              <th className="px-6 py-3 font-bold text-gray-600 dark:text-gray-400">Events</th>
                              <th className="px-6 py-3 font-bold text-gray-600 dark:text-gray-400">Status</th>
                              <th className="px-6 py-3 font-bold text-gray-600 dark:text-gray-400">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                           <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                              <td className="px-6 py-4 font-mono text-xs text-primary-600">https://api.lab-research.com/webhooks</td>
                              <td className="px-6 py-4">
                                 <div className="flex flex-wrap gap-1">
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold rounded">task.fail</span>
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold rounded">node.down</span>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <span className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs uppercase tracking-widest">
                                    <IconCheck className="w-3 h-3" /> Active
                                 </span>
                              </td>
                              <td className="px-6 py-4">
                                 <button className="text-gray-400 hover:text-primary-500"><IconDotsVertical className="w-4 h-4" /></button>
                              </td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
        active 
          ? "bg-primary-600 text-white shadow-md shadow-primary-500/20" 
          : "text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
      )}
    >
      <Icon className="w-4 h-4" stroke={1.5} />
      {label}
    </button>
  );
}

function NotificationRow({ label }: { label: string }) {
  return (
    <tr>
      <td className="py-4 text-sm text-gray-700 dark:text-gray-300 font-medium">{label}</td>
      <td className="py-4 text-center"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /></td>
      <td className="py-4 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /></td>
      <td className="py-4 text-center"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /></td>
    </tr>
  );
}

function ConnectionItem({ icon: Icon, name, category, connected = false }: { icon: any, name: string, category: string, connected?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700">
           <Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{name}</p>
          <p className="text-xs text-gray-500">{category}</p>
        </div>
      </div>
      <div className="flex items-center">
        {connected ? (
          <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <IconTrash className="w-5 h-5" />
          </button>
        ) : (
          <button className="p-2 text-gray-400 hover:text-primary-500 transition-colors">
            <IconChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
