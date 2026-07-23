import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listRentPayments, upsertRentPayment, deleteRentPayment } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listRentPaymentsWorkflow = (input: Parameters<typeof listRentPayments>[0]) => listRentPayments(input);
export const upsertRentPaymentWorkflow = (input: Parameters<typeof upsertRentPayment>[0]) =>
  upsertRentPayment(input);
export const deleteRentPaymentWorkflow = (input: Parameters<typeof deleteRentPayment>[0]) =>
  deleteRentPayment(input);
