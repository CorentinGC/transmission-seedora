import type { LandingLang } from './hosts';

export interface LandingContent {
  htmlLang: string;
  title: string;
  description: string;
  heroTitle: string;
  heroText: string;
  openApp: string;
  download: string;
  features: { title: string; text: string }[];
  featuresTitle: string;
  downloadTitle: string;
  downloadText: string;
  platforms: { name: string; formats: string }[];
  screenshotsTitle: string;
  alt: { light: string; dark: string; mobile: string };
  openSource: string;
  github: string;
  otherLanguage: { label: string; href: string };
}

/** Landing copy per language. Marketing text only: the app UI is translated in `packages/shared` (23 locales). */
export const LANDING_CONTENT: Record<LandingLang, LandingContent> = {
  en: {
    htmlLang: 'en',
    title: 'Seedora: a modern remote GUI for Transmission',
    description:
      'Seedora is a free, open source desktop and web client for the Transmission BitTorrent daemon: fast torrent list, peers, trackers, files, 23 languages.',
    heroTitle: 'The remote GUI Transmission deserves',
    heroText:
      'Manage the Transmission daemon on your NAS, seedbox or server from a fast, clean interface on desktop and in the browser. Free and open source.',
    openApp: 'Open the web app',
    download: 'Download for desktop',
    featuresTitle: 'Everything you need to run your daemon',
    features: [
      {
        title: 'Fast, even with thousands of torrents',
        text: 'A virtualised list stays smooth while you filter, sort and search.',
      },
      {
        title: 'Full details',
        text: 'Peers with country flags, trackers, files and priorities, speed limits and statistics.',
      },
      {
        title: 'Desktop and web',
        text: 'The same interface as a native app (macOS, Windows, Linux) and as an installable web app.',
      },
      {
        title: 'Multiple servers',
        text: 'Switch between daemons in one click. Passwords are stored encrypted by your system.',
      },
      {
        title: 'Magnet links and .torrent files',
        text: 'Open them straight from your browser or file manager, or drop them in a watch folder.',
      },
      { title: '23 languages, light and dark', text: 'Fully translated, keyboard-operable and accessible.' },
    ],
    downloadTitle: 'Install Seedora',
    downloadText: 'Installers are published with every release on GitHub.',
    platforms: [
      { name: 'macOS', formats: 'DMG, ZIP' },
      { name: 'Windows', formats: 'Setup .exe' },
      { name: 'Linux', formats: 'DEB, RPM' },
    ],
    screenshotsTitle: 'See it in action',
    alt: {
      light: 'Seedora desktop interface, light theme',
      dark: 'Seedora desktop interface, dark theme',
      mobile: 'Seedora on a phone, dark theme',
    },
    openSource: 'Open source under the MIT license.',
    github: 'View on GitHub',
    otherLanguage: { label: 'Français', href: '/fr' },
  },
  fr: {
    htmlLang: 'fr',
    title: 'Seedora : une interface web et bureau moderne pour Transmission',
    description:
      'Seedora est un client gratuit et open source, bureau et web, pour le démon BitTorrent Transmission : liste rapide, pairs, trackers, fichiers, 23 langues.',
    heroTitle: "L'interface distante que Transmission mérite",
    heroText:
      'Gérez le démon Transmission de votre NAS, seedbox ou serveur depuis une interface rapide et claire, sur ordinateur comme dans le navigateur. Gratuit et open source.',
    openApp: "Ouvrir l'application web",
    download: 'Télécharger pour le bureau',
    featuresTitle: 'Tout ce qu’il faut pour piloter votre démon',
    features: [
      {
        title: 'Fluide avec des milliers de torrents',
        text: 'Une liste virtualisée reste rapide pendant le filtrage, le tri et la recherche.',
      },
      {
        title: 'Détails complets',
        text: 'Pairs avec drapeaux des pays, trackers, fichiers et priorités, limites de débit et statistiques.',
      },
      {
        title: 'Bureau et web',
        text: 'La même interface en application native (macOS, Windows, Linux) et en application web installable.',
      },
      {
        title: 'Plusieurs serveurs',
        text: 'Passez d’un démon à l’autre en un clic. Les mots de passe sont chiffrés par votre système.',
      },
      {
        title: 'Liens magnet et fichiers .torrent',
        text: 'Ouvrez-les depuis votre navigateur ou votre gestionnaire de fichiers, ou déposez-les dans un dossier surveillé.',
      },
      { title: '23 langues, clair et sombre', text: 'Entièrement traduite, utilisable au clavier et accessible.' },
    ],
    downloadTitle: 'Installer Seedora',
    downloadText: 'Les installeurs sont publiés à chaque version sur GitHub.',
    platforms: [
      { name: 'macOS', formats: 'DMG, ZIP' },
      { name: 'Windows', formats: 'Installeur .exe' },
      { name: 'Linux', formats: 'DEB, RPM' },
    ],
    screenshotsTitle: 'Aperçu',
    alt: {
      light: 'Interface de bureau de Seedora, thème clair',
      dark: 'Interface de bureau de Seedora, thème sombre',
      mobile: 'Seedora sur téléphone, thème sombre',
    },
    openSource: 'Open source sous licence MIT.',
    github: 'Voir sur GitHub',
    otherLanguage: { label: 'English', href: '/' },
  },
};
