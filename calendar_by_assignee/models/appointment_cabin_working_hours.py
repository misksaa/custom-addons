from odoo import api, fields, models

class AppointmentCabin(models.Model):
    _inherit = "appointment.cabin"

    cabin_working_hour_ids = fields.One2many(
        "appointment.cabin.working.hour",
        "cabin_id",
        string="Working Hours",
        copy=True,
    )


class AppointmentCabinWorkingHour(models.Model):
    _name = "appointment.cabin.working.hour"
    _description = "Cabin Working Hours"
    _order = "day_code, time_from"

    cabin_id = fields.Many2one(
        "appointment.cabin",
        required=True,
        ondelete="cascade",
        index=True,
    )

    line_name = fields.Char(string="Name", required=True)

    day_code = fields.Selection([
        ('0', 'Monday'),
        ('1', 'Tuesday'),
        ('2', 'Wednesday'),
        ('3', 'Thursday'),
        ('4', 'Friday'),
        ('5', 'Saturday'),
        ('6', 'Sunday'),
    ], string="Day of Week", required=True)

    day_slot = fields.Selection([
        ('morning', 'Morning'),
        ('break', 'Break'),
        ('afternoon', 'Afternoon'),
    ], string="Day Period", required=True)

    is_break = fields.Boolean(string="Is Break Period")
    time_from = fields.Float(string="Work from")
    time_to = fields.Float(string="Work to")

    duration_hours = fields.Float(
        string="Duration (hrs)",
        compute="_compute_duration",
        store=True
    )

    @api.depends("time_from", "time_to", "is_break")
    def _compute_duration(self):
        for rec in self:
            if rec.is_break:
                rec.duration_hours = 0.0
                continue

            start = rec.time_from or 0.0
            end = rec.time_to or 0.0


            if end < start:
                end += 24.0

            rec.duration_hours = max(end - start, 0.0)
