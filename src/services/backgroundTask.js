import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runSmartAdvisorCheck } from './smartAdvisor';

export const OUTDOOR_ADVISOR_CHECK = 'OUTDOOR_ADVISOR_CHECK';

TaskManager.defineTask(OUTDOOR_ADVISOR_CHECK, async () => {
  try {
    await runSmartAdvisorCheck({ reason: 'background', promptForHealth: false });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerOutdoorAdvisorBackgroundTask() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return false;
  }

  await BackgroundTask.registerTaskAsync(OUTDOOR_ADVISOR_CHECK, {
    minimumInterval: 120,
  });

  return true;
}
