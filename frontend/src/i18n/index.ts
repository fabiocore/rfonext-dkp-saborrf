import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'pt-BR',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Mantém <html lang="..."> em dia com o idioma da interface (era fixo em
// "en" no index.html, herdado do scaffold do Vite, mesmo quando a página
// era toda em português). Isso ajuda o navegador a sugerir tradução
// automática sozinho (ex: "Traduzir esta página?" do Chrome) quando o
// conteúdo livre digitado pelo GM/conselho (Avisos etc. — sempre em pt-BR,
// nunca traduzido pelo sistema) não bate com o idioma da interface
// escolhido pelo visitante.
function syncHtmlLang() {
  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;
}
i18n.on('languageChanged', syncHtmlLang);
syncHtmlLang();

export default i18n;
