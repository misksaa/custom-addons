# -*- coding: utf-8 -*-
import logging
from odoo import models, fields, api, _

_logger = logging.getLogger(__name__)


class HmsAppointment(models.Model):
    _inherit = "hms.appointment"

    treatment_schedule_line_id = fields.Many2one(
        "hms.treatment.schedule.line",
        string="Treatment Schedule Line",
    )

    treatment_schedule_id = fields.Many2one(
        related="treatment_schedule_line_id.schedule_id",
        string="Treatment Schedule",
        store=True,
    )

    treatment_week = fields.Selection([
        ('1', 'Week 1'),
        ('2', 'Week 2'),
        ('3', 'Week 3'),
        ('4', 'Week 4'),
        ('5', 'Week 5'),
        ('6', 'Week 6'),
        ('7', 'Week 7'),
        ('8', 'Week 8'),
        ('9', 'Week 9'),
        ('10', 'Week 10'),
    ], string="Treatment Week")

    def action_print_treatment_schedule_from_appointment(self):
        """Open treatment schedules for the patient"""
        self.ensure_one()
        patient = self.patient_id

        _logger.info(
            "Opening Treatment Schedules from Appointment: Appointment ID=%s, Patient=%s",
            self.id, patient.name if patient else 'None'
        )

        return {
            "type": "ir.actions.act_window",
            "name": _("Treatment Schedules"),
            "res_model": "hms.treatment.schedule",
            "view_mode": "list,form",
            "domain": [("patient_id", "=", patient.id)] if patient else [],
            "context": {"default_patient_id": patient.id} if patient else {},
        }

    def action_link_to_treatment_schedule(self):
        """Link this appointment to a treatment schedule line"""
        self.ensure_one()
        _logger.info("Linking Appointment to Treatment Schedule: ID=%s", self.id)

        return {
            "type": "ir.actions.act_window",
            "name": _("Link to Treatment Schedule"),
            "res_model": "hms.appointment.link.treatment.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_appointment_id": self.id,
                "default_patient_id": self.patient_id.id if self.patient_id else False,
            },
        }

    @api.model
    def create_from_treatment_schedule(self, schedule_line_id, week_number, appointment_data):
        """Create an appointment from treatment schedule"""
        _logger.info(
            "Creating Appointment from Treatment Schedule: Line ID=%s, Week=%s",
            schedule_line_id, week_number
        )

        line = self.env['hms.treatment.schedule.line'].browse(schedule_line_id)
        if not line.exists():
            _logger.error("Treatment Schedule Line not found: ID=%s", schedule_line_id)
            return False

        # Add treatment schedule info to appointment data
        appointment_data.update({
            'treatment_schedule_line_id': schedule_line_id,
            'treatment_week': str(week_number),
            'patient_id': line.schedule_id.patient_id.id,
        })

        # Create the appointment
        appointment = self.create(appointment_data)

        # Link the appointment to the schedule line
        line.write({f'wk{week_number}_appointment_ids': [(4, appointment.id)]})

        _logger.info(
            "Appointment Created from Treatment Schedule: ID=%s, Name=%s",
            appointment.id, appointment.name
        )

        return {
            'id': appointment.id,
            'name': appointment.name,
        }