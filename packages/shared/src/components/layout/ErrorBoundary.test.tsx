import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

const i18n = i18next.createInstance();
i18n.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        errorBoundary: { title: 'TITLE', description: 'DESC', retry: 'RETRY', reload: 'RELOAD' },
      },
    },
  },
});

const render = (node: React.ReactNode) => renderToStaticMarkup(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);

describe('ErrorBoundary', () => {
  it('flags the error state without keeping the error', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
  });

  it('renders children when nothing failed', () => {
    expect(
      render(
        <ErrorBoundary>
          <p>ok</p>
        </ErrorBoundary>,
      ),
    ).toContain('ok');
  });

  it('logs the caught error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boundary = new ErrorBoundary({ children: null });
    boundary.componentDidCatch(new Error('boom'), { componentStack: 'stack' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ErrorFallback', () => {
  it('is an alert with retry and reload actions and no raw error text', () => {
    const html = render(<ErrorFallback onRetry={() => undefined} onReload={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('TITLE');
    expect(html).toContain('RETRY');
    expect(html).toContain('RELOAD');
  });
});
