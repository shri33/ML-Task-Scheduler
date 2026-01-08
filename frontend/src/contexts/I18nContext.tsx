import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, Translations, getTranslation, detectBrowserLanguage, supportedLanguages } from '../lib/i18n';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  supportedLanguages: typeof supportedLanguages;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved && ['en', 'es', 'fr'].includes(saved)) {
      return saved as Language;
    }
    return detectBrowserLanguage();
  });

  const [translations, setTranslations] = useState<Translations>(getTranslation(language));

  useEffect(() => {
    setTranslations(getTranslation(language));
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: translations,
        supportedLanguages,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// HOC for class components
export const withI18n = <P extends object>(
  WrappedComponent: React.ComponentType<P & I18nContextType>
) => {
  return (props: P) => {
    const i18n = useI18n();
    return <WrappedComponent {...props} {...i18n} />;
  };
};
