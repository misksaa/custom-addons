# -*- coding: utf-8 -*-
import logging
from odoo import fields, models

_logger = logging.getLogger(__name__)


class HmsPatient(models.Model):
    _inherit = "hms.patient"

    treatment_schedule_count = fields.Integer(
        string="Treatment Schedule Count",
        compute="_compute_treatment_schedule_count",
    )

    treatment_schedule_ids = fields.One2many(
        'hms.treatment.schedule',
        'patient_id',
        string='Treatment Schedules',
    )

    def _compute_treatment_schedule_count(self):
        Schedule = self.env["hms.treatment.schedule"]
        for rec in self:
            count = Schedule.search_count([("patient_id", "=", rec.id)])
            rec.treatment_schedule_count = count
            _logger.debug(
                "Patient %s has %d treatment schedules",
                rec.name, count
            )

    def action_open_treatment_schedule(self):
        """Open treatment schedules for this patient"""
        self.ensure_one()
        _logger.info(
            "Opening treatment schedules for patient: ID=%s, Name=%s",
            self.id, self.name
        )
        return {
            "type": "ir.actions.act_window",
            "name": "Treatment Schedules",
            "res_model": "hms.treatment.schedule",
            "view_mode": "list,form",
            "domain": [("patient_id", "=", self.id)],
            "context": {
                "default_patient_id": self.id,
                "default_date": fields.Date.context_today(self),
            },
        }