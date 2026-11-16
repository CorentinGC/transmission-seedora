import { useTranslation } from 'react-i18next';

export type ApplyState = 'idle' | 'success' | 'error';

/** Outcome of an "Apply" action: the polite status region stays mounted so screen readers announce its text; errors are an alert. */
export function ApplyStatus({ status }: { status: ApplyState }) {
  const { t } = useTranslation();
  return (
    <>
      <span role="status" className="text-xs text-success">
        {status === 'success' ? t('settings.applied') : null}
      </span>
      {status === 'error' && (
        <span role="alert" className="text-xs text-destructive-text">
          {t('settings.applyError')}
        </span>
      )}
    </>
  );
}
