// Jest setup file

// Mock i18n for date utils tests
jest.mock('../lib/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: { count?: number }) => {
      const translations: Record<string, string> = {
        'date.justNow': 'Just now',
        'date.minutesAgo': `${options?.count}m ago`,
        'date.hoursAgo': `${options?.count}h ago`,
        'date.yesterday': 'Yesterday',
      };
      return translations[key] || key;
    },
    language: 'en',
  },
}));
