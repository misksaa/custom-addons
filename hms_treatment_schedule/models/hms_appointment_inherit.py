# -*- coding: utf-8 -*-
import logging
from odoo import models, _

_logger = logging.getLogger(__name__)


class HmsAppointment(models.Model):
    _inherit = "hms.appointment"

    def action_print_treatment_schedule_from_appointment(self):
        """Open treatment schedules from appointment context"""
        self.ensure_one()
        patient = self.patient_id

        _logger.info(
            "Opening treatment schedules from appointment: ID=%s, Patient=%s",
            self.id, patient.name if patient else 'N/A'
        )

        return {
            "type": "ir.actions.act_window",
            "name": _("Treatment Schedules"),
            "res_model": "hms.treatment.schedule",
            "view_mode": "list,form",
            "domain": [("patient_id", "=", patient.id)] if patient else [],
            "context": {"default_patient_id": patient.id} if patient else {},
        }
