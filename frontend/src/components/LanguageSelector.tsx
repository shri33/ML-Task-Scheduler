import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Globe } from 'lucide-react';
import { clsx } from 'clsx';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  className,
}) => {
  const { language, setLanguage, supportedLanguages } = useI18n();
  const [isOpen, setIsOpen] = React.useState(false);

  const currentLang = supportedLanguages.find((l) => l.code === language);

  if (variant === 'buttons') {
    return (
      <div className={clsx('flex gap-1', className)}>
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={clsx(
              'px-2 py-1 rounded text-sm font-medium transition-colors',
              language === lang.code
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
            title={lang.name}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'text-gray-700 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'transition-colors'
        )}
        aria-label="Select language"
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm">{currentLang?.flag} {currentLang?.name}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              'absolute right-0 mt-2 w-40 py-1 z-50',
              'bg-white dark:bg-gray-800',
              'rounded-lg shadow-lg border border-gray-200 dark:border-gray-700'
            )}
          >
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-4 py-2 text-sm',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'transition-colors',
                  language === lang.code
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300'
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
