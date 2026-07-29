import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const {
  addPropertyPhotoActivity,
  listPropertyPhotosActivity,
  deletePropertyPhotoActivity,
  listListingPhotosActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const addPropertyPhotoWorkflow = (input: Parameters<typeof addPropertyPhotoActivity>[0]) =>
  addPropertyPhotoActivity(input);
export const listPropertyPhotosWorkflow = (input: Parameters<typeof listPropertyPhotosActivity>[0]) =>
  listPropertyPhotosActivity(input);
export const deletePropertyPhotoWorkflow = (input: Parameters<typeof deletePropertyPhotoActivity>[0]) =>
  deletePropertyPhotoActivity(input);
export const listListingPhotosWorkflow = (input: Parameters<typeof listListingPhotosActivity>[0]) =>
  listListingPhotosActivity(input);
