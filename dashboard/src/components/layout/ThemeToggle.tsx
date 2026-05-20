import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from './ThemeProvider';
import { useI18n } from '@/lib/i18n';

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="sr-only">{t('theme.toggle')}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {resolvedTheme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      </TooltipContent>
    </Tooltip>
  );
}
