import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../ui';

interface ExportPasswordsOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** Opt-in checkbox (default off) that adds server and proxy passwords to an export, with a plain-text warning. */
export function ExportPasswordsOption({ checked, onChange, className = '' }: ExportPasswordsOptionProps) {
  const { t } = useTranslation();
  const warningId = useId();
  return (
    <div className={className}>
      <Checkbox
        className="text-xs"
        label={t('server.exportPasswords')}
        checked={checked}
        aria-describedby={warningId}
        onChange={(e) => onChange(e.target.checked)}
      />
      <p id={warningId} className="mt-1 text-xs text-muted-foreground">
        {t('server.exportPasswordsWarning')}
      </p>
    </div>
  );
}
