import { IconInfoCircle } from '@tabler/icons-react';

/**
 * Banner displayed on pages that use static/demo data rather than live backend APIs.
 * This prevents users from being misled about the data they're seeing.
 */
export default function DemoModeBanner({ featureName }: { featureName: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-sm">
      <IconInfoCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-amber-800 dark:text-amber-200 font-medium">
        <strong>{featureName}</strong> is a UI preview with sample data. Backend integration is on the roadmap.
      </p>
    </div>
  );
}
