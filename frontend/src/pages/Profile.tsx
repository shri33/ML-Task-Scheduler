import { useState, useEffect, useMemo } from 'react';
import { User, Mail, Phone, MapPin, Building, Calendar, Camera, Save, X, Sun, Moon, Bell, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { authApi } from '../lib/api';
import { useStore } from '../store';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  address: string;
  organization: string;
  role: string;
  bio: string;
  joinedDate: string;
}

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const { tasks, resources, fetchTasks, fetchResources } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [compactView, setCompactView] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    organization: '',
    role: 'Developer',
    bio: '',
    joinedDate: new Date().toISOString().split('T')[0],
  });

  const [editedProfile, setEditedProfile] = useState<ProfileData>(profile);

  // Load saved profile from localStorage
  useEffect(() => {
    fetchTasks();
    fetchResources();
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
      setEditedProfile(parsed);
    } else if (user) {
      const initialProfile = {
        ...profile,
        name: user.name || '',
        email: user.email || '',
      };
      setProfile(initialProfile);
      setEditedProfile(initialProfile);
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Persist to backend
      await authApi.updateProfile({
        name: editedProfile.name,
        email: editedProfile.email,
      });
      // Cache locally for fast reloads
      localStorage.setItem('userProfile', JSON.stringify(editedProfile));
      setProfile(editedProfile);
      setIsEditing(false);
      toast.success('Profile updated', 'Your account details have been saved.');
    } catch (error) {
      toast.error('Failed to save', 'Could not update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  // Compute real statistics from store data
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const totalResources = resources.length;
    const oldestTask = tasks.length > 0
      ? tasks.reduce((oldest, t) => new Date(t.createdAt) < new Date(oldest.createdAt) ? t : oldest)
      : null;
    const daysActive = oldestTask
      ? Math.max(1, Math.ceil((Date.now() - new Date(oldestTask.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    return {
      totalTasks: String(totalTasks),
      completedTasks: String(completedTasks),
      totalResources: String(totalResources),
      daysActive: String(daysActive),
    };
  }, [tasks, resources]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account information and preferences
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="btn btn-secondary flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="card">
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
            {isEditing && (
              <button className="absolute bottom-0 right-0 p-2 bg-primary-600 rounded-full text-white hover:bg-primary-700 transition-colors">
                <Camera className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {profile.name || 'User'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{profile.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm rounded-full">
                {profile.role}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(profile.joinedDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div>
            <label className="label flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              Full Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedProfile.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input"
                placeholder="Enter your full name"
              />
            ) : (
              <p className="text-gray-900 dark:text-white py-2">{profile.name || '-'}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="label flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              Email Address
            </label>
            {isEditing ? (
              <input
                type="email"
                value={editedProfile.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="input"
                placeholder="Enter your email"
              />
            ) : (
              <p className="text-gray-900 dark:text-white py-2">{profile.email || '-'}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="label flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              Phone Number
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={editedProfile.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="input"
                placeholder="Enter your phone number"
              />
            ) : (
              <p className="text-gray-900 dark:text-white py-2">{profile.phone || '-'}</p>
            )}
          </div>

          {/* Organization */}
          <div>
            <label className="label flex items-center gap-2">
              <Building className="h-4 w-4 text-gray-400" />
              Organization
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedProfile.organization}
                onChange={(e) => handleChange('organization', e.target.value)}
                className="input"
                placeholder="Enter your organization"
              />
            ) : (
              <p className="text-gray-900 dark:text-white py-2">{profile.organization || '-'}</p>
            )}
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="label flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              Address
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedProfile.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="input"
                placeholder="Enter your address"
              />
            ) : (
              <p className="text-gray-900 dark:text-white py-2">{profile.address || '-'}</p>
            )}
          </div>

          {/* Bio */}
          <div className="md:col-span-2">
            <label className="label">Bio</label>
            {isEditing ? (
              <textarea
                value={editedProfile.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                className="input min-h-[100px] resize-none"
                placeholder="Tell us about yourself..."
                rows={4}
              />
            ) : (
              <p className="text-gray-900 dark:text-white py-2">
                {profile.bio || 'No bio added yet.'}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="label">Role</label>
            {isEditing ? (
              <select
                value={editedProfile.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="select"
              >
                <option value="Developer">Developer</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Analyst">Analyst</option>
                <option value="Researcher">Researcher</option>
              </select>
            ) : (
              <p className="text-gray-900 dark:text-white py-2">{profile.role}</p>
            )}
          </div>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Appearance & Preferences
        </h3>
        <div className="space-y-4">
          {/* Theme Selection */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-primary-600 dark:text-primary-400" /> : <Sun className="h-5 w-5 text-yellow-500" />}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                theme === 'dark' ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates about task completions</p>
              </div>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notificationsEnabled ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Compact View */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Monitor className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Compact View</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show more items with less spacing</p>
              </div>
            </div>
            <button
              onClick={() => setCompactView(!compactView)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                compactView ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  compactView ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Account Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tasks Created" value={stats.totalTasks} />
          <StatCard label="Tasks Completed" value={stats.completedTasks} />
          <StatCard label="Resources Used" value={stats.totalResources} />
          <StatCard label="Days Active" value={stats.daysActive} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200 dark:border-red-900/50">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
          Danger Zone
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="btn btn-danger">
          Delete Account
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
