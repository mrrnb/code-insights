import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

export function EmptySessions() {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('empty.noSessionsFound')}</h3>
        <p className="text-muted-foreground max-w-md">
          {t('empty.noSessionsFoundDesc')}
        </p>
      </CardContent>
    </Card>
  );
}
