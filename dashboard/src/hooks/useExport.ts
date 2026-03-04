import { useMutation } from '@tanstack/react-query';
import { exportMarkdown } from '@/lib/api';
import type { ExportTemplate } from '@/lib/types';

interface ExportParams {
  sessionIds?: string[];
  projectId?: string;
  template?: ExportTemplate;
}

export function useExportMarkdown() {
  return useMutation({
    mutationFn: (params: ExportParams) => exportMarkdown(params),
  });
}
