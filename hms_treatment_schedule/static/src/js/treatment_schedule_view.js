/** @odoo-module **/
import { registry } from "@web/core/registry";
import { TreatmentScheduleController } from "./treatment_schedule_controller";

console.log('[TreatmentScheduleView] Registering treatment_schedule_view action');

// Register the client action
const actionRegistry = registry.category("actions");
actionRegistry.add("treatment_schedule_view", TreatmentScheduleController);

console.log('[TreatmentScheduleView] Action registered successfully');