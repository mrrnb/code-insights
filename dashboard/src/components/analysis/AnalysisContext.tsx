/**
 * Analysis context for the embedded dashboard.
 * Unlike the web app which calls LLM providers directly in the browser,
 * this version delegates all analysis to the Hono server via POST /api/analysis/session.
 * The useAnalyzeSession() hook from Layer 2 handles the API call.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { analyzeSession, analyzePromptQuality } from '@/lib/api';
import { getSessionTitle } from '@/lib/utils';
import type { Session } from '@/lib/types';
import { toast } from 'sonner';

const ANALYSIS_TOAST_ID = 'analysis-toast';

export interface AnalysisState {
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  sessionId: string | null;
  sessionTitle: string | null;
  type: 'session' | 'prompt_quality';
  progress: { message: string } | null;
  result: {
    success: boolean;
    insightCount?: number;
    error?: string;
  } | null;
}

interface AnalysisContextValue {
  state: AnalysisState;
  startAnalysis: (session: Session, type: 'session' | 'prompt_quality') => Promise<void>;
  cancelAnalysis: () => void;
  clearResult: () => void;
}

const IDLE_STATE: AnalysisState = {
  status: 'idle',
  sessionId: null,
  sessionTitle: null,
  type: 'session',
  progress: null,
  result: null,
};

const AnalysisContext = createContext<AnalysisContextValue>({
  state: IDLE_STATE,
  startAnalysis: async () => {},
  cancelAnalysis: () => {},
  clearResult: () => {},
});

export function useAnalysis() {
  return useContext(AnalysisContext);
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>(IDLE_STATE);
  const queryClient = useQueryClient();

  const cancelAnalysis = useCallback(() => {
    setState(IDLE_STATE);
    toast.dismiss(ANALYSIS_TOAST_ID);
  }, []);

  const clearResult = useCallback(() => {
    setState(IDLE_STATE);
  }, []);

  const startAnalysis = useCallback(
    async (session: Session, type: 'session' | 'prompt_quality') => {
      if (state.status === 'analyzing') {
        toast.warning('Analysis already in progress.');
        return;
      }

      const sessionTitle = getSessionTitle(session);

      setState({
        status: 'analyzing',
        sessionId: session.id,
        sessionTitle,
        type,
        progress: { message: `Analyzing "${sessionTitle}"...` },
        result: null,
      });

      toast.loading(`Analyzing "${sessionTitle}"...`, { id: ANALYSIS_TOAST_ID });

      try {
        if (type === 'session') {
          await analyzeSession(session.id);
        } else {
          await analyzePromptQuality(session.id);
        }

        // Invalidate queries so data refreshes
        queryClient.invalidateQueries({ queryKey: ['insights'] });
        queryClient.invalidateQueries({ queryKey: ['session', session.id] });

        setState({
          status: 'complete',
          sessionId: session.id,
          sessionTitle,
          type,
          progress: null,
          result: { success: true },
        });
        toast.success('Analysis complete!', { id: ANALYSIS_TOAST_ID });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Analysis failed';
        setState({
          status: 'error',
          sessionId: session.id,
          sessionTitle,
          type,
          progress: null,
          result: { success: false, error: errorMsg },
        });
        toast.error(`Analysis failed: ${errorMsg}`, { id: ANALYSIS_TOAST_ID });
      }
    },
    [state.status, queryClient]
  );

  return (
    <AnalysisContext.Provider value={{ state, startAnalysis, cancelAnalysis, clearResult }}>
      {children}
    </AnalysisContext.Provider>
  );
}
