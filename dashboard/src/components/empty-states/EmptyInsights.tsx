import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

export function EmptyInsights() {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('empty.noInsights')}</h3>
        <p className="text-muted-foreground max-w-md">
          {t('empty.noInsightsDesc')}
        </p>
      </CardContent>
    </Card>
  );
}
