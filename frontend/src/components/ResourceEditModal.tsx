import { useState, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { Resource, UpdateResourceInput } from '../types';
import { resourceApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface ResourceEditModalProps {
  resource: Resource;
  onClose: () => void;
  onUpdated: (resource: Resource) => void;
}

export default function ResourceEditModal({ resource, onClose, onUpdated }: ResourceEditModalProps) {
  const [formData, setFormData] = useState<UpdateResourceInput>({
    name: resource.name,
    capacity: resource.capacity,
    currentLoad: resource.currentLoad,
    status: resource.status,
  });
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updated = await resourceApi.update(resource.id, formData);
      onUpdated(updated);
      toast.success('Resource updated', `"${updated.name}" has been updated successfully.`);
      onClose();
    } catch (error) {
      toast.error('Update failed', 'Could not update the resource. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Resource</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Resource Name
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Capacity
              </label>
              <input
                type="number"
                min="1"
                value={formData.capacity || 1}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Status
              </label>
              <select
                value={formData.status || 'AVAILABLE'}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as 'AVAILABLE' | 'BUSY' | 'OFFLINE' })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="AVAILABLE">Available</option>
                <option value="BUSY">Busy</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Current Load (%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.currentLoad || 0}
              onChange={(e) => setFormData({ ...formData, currentLoad: parseFloat(e.target.value) })}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>0%</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round(formData.currentLoad || 0)}%
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
