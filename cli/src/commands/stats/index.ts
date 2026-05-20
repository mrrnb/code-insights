import { Command } from 'commander';
import { applySharedFlags, parseFlags } from './shared.js';
import type { StatsFlags } from './shared.js';

// Wrapper that parses flags before calling the action
function wrapAction(actionFn: (flags: StatsFlags) => Promise<void>) {
  return async (options: Record<string, unknown>) => {
    const flags = parseFlags(options);
    await actionFn(flags);
  };
}

// Lazy import actions to avoid loading everything at module load time
async function overviewAction(flags: StatsFlags): Promise<void> {
  const { overviewAction: action } = await import('./actions/overview.js');
  return action(flags);
}

async function costAction(flags: StatsFlags): Promise<void> {
  const { costAction: action } = await import('./actions/cost.js');
  return action(flags);
}

async function projectsAction(flags: StatsFlags): Promise<void> {
  const { projectsAction: action } = await import('./actions/projects.js');
  return action(flags);
}

async function todayAction(flags: StatsFlags): Promise<void> {
  const { todayAction: action } = await import('./actions/today.js');
  return action(flags);
}

async function modelsAction(flags: StatsFlags): Promise<void> {
  const { modelsAction: action } = await import('./actions/models.js');
  return action(flags);
}

async function patternsAction(flags: StatsFlags): Promise<void> {
  const { patternsAction: action } = await import('./actions/patterns.js');
  return action(flags);
}

const costCommand = applySharedFlags(
  new Command('cost').description('按项目、模型和时间段的成本分析')
).action(wrapAction(costAction));

const projectsCommand = applySharedFlags(
  new Command('projects').description('按项目详情 — 会话、时间、成本、模型')
).action(wrapAction(projectsAction));

const todayCommand = applySharedFlags(
  new Command('today').description('今日会话：标题、时长、成本')
).action(wrapAction(todayAction));

const modelsCommand = applySharedFlags(
  new Command('models').description('模型使用分布、每模型成本、趋势')
).action(wrapAction(modelsAction));

const patternsCommand = applySharedFlags(
  new Command('patterns').description('跨会话模式 — 摩擦、收获、工作风格')
).action(wrapAction(patternsAction));

export const statsCommand = applySharedFlags(
  new Command('stats')
    .description('查看使用统计和分析')
    .addCommand(costCommand)
    .addCommand(projectsCommand)
    .addCommand(todayCommand)
    .addCommand(modelsCommand)
    .addCommand(patternsCommand)
).action(wrapAction(overviewAction));
