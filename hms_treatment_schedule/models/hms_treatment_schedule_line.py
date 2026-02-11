# -*- coding: utf-8 -*-
import logging
from odoo import fields, models, api

_logger = logging.getLogger(__name__)


class HmsTreatmentScheduleLine(models.Model):
    _name = "hms.treatment.schedule.line"
    _description = "Treatment Schedule Line"
    _order = "sequence, id"

    schedule_id = fields.Many2one(
        "hms.treatment.schedule",
        string="Schedule",
        required=True,
        ondelete="cascade",
        index=True,
    )

    sequence = fields.Integer(default=10)

    product_id = fields.Many2one(
        "product.product",
        string="Session Type",
        required=True,
    )

    # Week 1
    wk1_date = fields.Date(string="WK1 Date")
    wk1_number = fields.Char(string="WK1")
    wk1_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk1_appointment_rel',
        'line_id', 'appointment_id',
        string='WK1 Appointments'
    )
    wk1_appointments_count = fields.Integer(
        string="WK1 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 2
    wk2_date = fields.Date(string="WK2 Date")
    wk2_number = fields.Char(string="WK2")
    wk2_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk2_appointment_rel',
        'line_id', 'appointment_id',
        string='WK2 Appointments'
    )
    wk2_appointments_count = fields.Integer(
        string="WK2 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 3
    wk3_date = fields.Date(string="WK3 Date")
    wk3_number = fields.Char(string="WK3")
    wk3_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk3_appointment_rel',
        'line_id', 'appointment_id',
        string='WK3 Appointments'
    )
    wk3_appointments_count = fields.Integer(
        string="WK3 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 4
    wk4_date = fields.Date(string="WK4 Date")
    wk4_number = fields.Char(string="WK4")
    wk4_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk4_appointment_rel',
        'line_id', 'appointment_id',
        string='WK4 Appointments'
    )
    wk4_appointments_count = fields.Integer(
        string="WK4 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 5
    wk5_date = fields.Date(string="WK5 Date")
    wk5_number = fields.Char(string="WK5")
    wk5_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk5_appointment_rel',
        'line_id', 'appointment_id',
        string='WK5 Appointments'
    )
    wk5_appointments_count = fields.Integer(
        string="WK5 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 6
    wk6_date = fields.Date(string="WK6 Date")
    wk6_number = fields.Char(string="WK6")
    wk6_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk6_appointment_rel',
        'line_id', 'appointment_id',
        string='WK6 Appointments'
    )
    wk6_appointments_count = fields.Integer(
        string="WK6 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 7
    wk7_date = fields.Date(string="WK7 Date")
    wk7_number = fields.Char(string="WK7")
    wk7_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk7_appointment_rel',
        'line_id', 'appointment_id',
        string='WK7 Appointments'
    )
    wk7_appointments_count = fields.Integer(
        string="WK7 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 8
    wk8_date = fields.Date(string="WK8 Date")
    wk8_number = fields.Char(string="WK8")
    wk8_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk8_appointment_rel',
        'line_id', 'appointment_id',
        string='WK8 Appointments'
    )
    wk8_appointments_count = fields.Integer(
        string="WK8 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 9
    wk9_date = fields.Date(string="WK9 Date")
    wk9_number = fields.Char(string="WK9")
    wk9_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk9_appointment_rel',
        'line_id', 'appointment_id',
        string='WK9 Appointments'
    )
    wk9_appointments_count = fields.Integer(
        string="WK9 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    # Week 10
    wk10_date = fields.Date(string="WK10 Date")
    wk10_number = fields.Char(string="WK10")
    wk10_appointment_ids = fields.Many2many(
        'hms.appointment',
        'treatment_schedule_line_wk10_appointment_rel',
        'line_id', 'appointment_id',
        string='WK10 Appointments'
    )
    wk10_appointments_count = fields.Integer(
        string="WK10 Appointments",
        compute="_compute_wk_appointments_count",
        store=True
    )

    @api.depends(
        'wk1_appointment_ids', 'wk2_appointment_ids', 'wk3_appointment_ids',
        'wk4_appointment_ids', 'wk5_appointment_ids', 'wk6_appointment_ids',
        'wk7_appointment_ids', 'wk8_appointment_ids', 'wk9_appointment_ids',
        'wk10_appointment_ids'
    )
    def _compute_wk_appointments_count(self):
        """Compute appointments count for each week"""
        for rec in self:
            rec.wk1_appointments_count = len(rec.wk1_appointment_ids)
            rec.wk2_appointments_count = len(rec.wk2_appointment_ids)
            rec.wk3_appointments_count = len(rec.wk3_appointment_ids)
            rec.wk4_appointments_count = len(rec.wk4_appointment_ids)
            rec.wk5_appointments_count = len(rec.wk5_appointment_ids)
            rec.wk6_appointments_count = len(rec.wk6_appointment_ids)
            rec.wk7_appointments_count = len(rec.wk7_appointment_ids)
            rec.wk8_appointments_count = len(rec.wk8_appointment_ids)
            rec.wk9_appointments_count = len(rec.wk9_appointment_ids)
            rec.wk10_appointments_count = len(rec.wk10_appointment_ids)

            _logger.debug(
                "Computed appointments count for line %s: WK1=%d, WK2=%d, WK3=%d, WK4=%d, WK5=%d, WK6=%d, WK7=%d, WK8=%d, WK9=%d, WK10=%d",
                rec.id,
                rec.wk1_appointments_count,
                rec.wk2_appointments_count,
                rec.wk3_appointments_count,
                rec.wk4_appointments_count,
                rec.wk5_appointments_count,
                rec.wk6_appointments_count,
                rec.wk7_appointments_count,
                rec.wk8_appointments_count,
                rec.wk9_appointments_count,
                rec.wk10_appointments_count
            )

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            _logger.info(
                "Treatment Schedule Line Created: ID=%s, Schedule=%s, Product=%s",
                rec.id,
                rec.schedule_id.name,
                rec.product_id.display_name
            )
        return records

    def write(self, vals):
        result = super().write(vals)
        for rec in self:
            _logger.info(
                "Treatment Schedule Line Updated: ID=%s, Schedule=%s, Fields=%s",
                rec.id,
                rec.schedule_id.name,
                list(vals.keys())
            )
        return result

    def unlink(self):
        for rec in self:
            _logger.info(
                "Treatment Schedule Line Deleted: ID=%s, Schedule=%s, Product=%s",
                rec.id,
                rec.schedule_id.name,
                rec.product_id.display_name
            )
        return super().unlink()

    @api.model
    def get_line_data(self, line_id):
        """Get line data for JavaScript view"""
        _logger.info("Fetching line data for ID: %s", line_id)

        line = self.browse(line_id)
        if not line.exists():
            _logger.warning("Line not found: ID=%s", line_id)
            return {}

        data = {
            'id': line.id,
            'sequence': line.sequence,
            'schedule_id': line.schedule_id.id,
            'product_id': line.product_id.id,
            'product_name': line.product_id.display_name,
        }

        # Add week data dynamically for all 10 weeks
        for week_num in range(1, 11):
            date_field = f'wk{week_num}_date'
            number_field = f'wk{week_num}_number'
            appointments_field = f'wk{week_num}_appointment_ids'
            count_field = f'wk{week_num}_appointments_count'

            data[date_field] = str(getattr(line, date_field)) if getattr(line, date_field) else ''
            data[number_field] = getattr(line, number_field) or ''
            data[count_field] = getattr(line, count_field) or 0

            # Get appointments details
            appointments = getattr(line, appointments_field)
            if appointments:
                data[f'wk{week_num}_appointments'] = [{
                    'id': app.id,
                    'name': app.name,
                    'date': str(app.date) if app.date else '',
                    'state': app.state,
                    'patient_id': app.patient_id.id,
                    'patient_name': app.patient_id.name,
                    'physician_id': app.physician_id.id if app.physician_id else None,
                    'physician_name': app.physician_id.name if app.physician_id else '',
                } for app in appointments]
            else:
                data[f'wk{week_num}_appointments'] = []

        _logger.info("Line data fetched: ID=%s", line_id)
        return data

    @api.model
    def create_line(self, schedule_id, product_id, sequence=10):
        """Create a new line from JavaScript view"""
        _logger.info(
            "Creating new line: Schedule=%s, Product=%s, Sequence=%s",
            schedule_id, product_id, sequence
        )

        line = self.create({
            'schedule_id': schedule_id,
            'product_id': product_id,
            'sequence': sequence,
        })

        return self.get_line_data(line.id)

    @api.model
    def update_line_week(self, line_id, week_number, date_value, number_value):
        """Update a specific week's date and number"""
        _logger.info(
            "Updating line week: ID=%s, Week=%s, Date=%s, Number=%s",
            line_id, week_number, date_value, number_value
        )

        line = self.browse(line_id)
        if not line.exists():
            _logger.warning("Line not found for update: ID=%s", line_id)
            return {'success': False, 'error': 'Line not found'}

        date_field = f'wk{week_number}_date'
        number_field = f'wk{week_number}_number'

        try:
            vals = {}
            if date_value:
                vals[date_field] = date_value
            if number_value is not None:
                vals[number_field] = number_value

            if vals:
                line.write(vals)
                _logger.info("Line week updated successfully: ID=%s", line_id)

            return {'success': True, 'line': self.get_line_data(line_id)}
        except Exception as e:
            _logger.error("Error updating line week: %s", str(e))
            return {'success': False, 'error': str(e)}

    @api.model
    def delete_line(self, line_id):
        """Delete a line from JavaScript view"""
        _logger.info("Deleting line: ID=%s", line_id)

        line = self.browse(line_id)
        if not line.exists():
            _logger.warning("Line not found for deletion: ID=%s", line_id)
            return {'success': False, 'error': 'Line not found'}

        try:
            line.unlink()
            _logger.info("Line deleted successfully: ID=%s", line_id)
            return {'success': True}
        except Exception as e:
            _logger.error("Error deleting line: %s", str(e))
            return {'success': False, 'error': str(e)}

    @api.model
    def update_line_product(self, line_id, product_id):
        """Update the product (session type) of a line"""
        _logger.info(
            "Updating line product: ID=%s, Product=%s",
            line_id, product_id
        )

        line = self.browse(line_id)
        if not line.exists():
            _logger.warning("Line not found for product update: ID=%s", line_id)
            return {'success': False, 'error': 'Line not found'}

        try:
            line.write({'product_id': product_id})
            _logger.info("Line product updated successfully: ID=%s", line_id)
            return {'success': True, 'line': self.get_line_data(line_id)}
        except Exception as e:
            _logger.error("Error updating line product: %s", str(e))
            return {'success': False, 'error': str(e)}



    @api.model
    def add_appointment_to_week(self, line_id, week_number, appointment_id):
        """Add appointment to a specific week"""
        _logger.info(
            "Adding appointment to week: Line=%s, Week=%s, Appointment=%s",
            line_id, week_number, appointment_id
        )

        line = self.browse(line_id)
        if not line.exists():
            _logger.warning("Line not found: ID=%s", line_id)
            return {'success': False, 'error': 'Line not found'}

        appointment = self.env['hms.appointment'].browse(appointment_id)
        if not appointment.exists():
            _logger.warning("Appointment not found: ID=%s", appointment_id)
            return {'success': False, 'error': 'Appointment not found'}

        try:
            appointments_field = f'wk{week_number}_appointment_ids'
            current_appointments = getattr(line, appointments_field)

            # Add appointment to the Many2many relation
            if appointment_id not in current_appointments.ids:
                line.write({appointments_field: [(4, appointment_id)]})
                _logger.info(
                    "Appointment added to week: Line=%s, Week=%s, Appointment=%s",
                    line_id, week_number, appointment_id
                )

            # Update appointment with treatment schedule info
            # First check if the fields exist
            appointment_vals = {'treatment_schedule_line_id': line_id}

            # Only add treatment_week if the field exists
            if hasattr(appointment, 'treatment_week'):
                appointment_vals['treatment_week'] = str(week_number)

            appointment.write(appointment_vals)

            return {
                'success': True,
                'line': self.get_line_data(line_id),
                'appointments_count': len(getattr(line, appointments_field))
            }
        except Exception as e:
            _logger.error("Error adding appointment to week: %s", str(e))
            return {'success': False, 'error': str(e)}

    @api.model
    def remove_appointment_from_week(self, line_id, week_number, appointment_id):
        """Remove appointment from a specific week"""
        _logger.info(
            "Removing appointment from week: Line=%s, Week=%s, Appointment=%s",
            line_id, week_number, appointment_id
        )

        line = self.browse(line_id)
        if not line.exists():
            _logger.warning("Line not found: ID=%s", line_id)
            return {'success': False, 'error': 'Line not found'}

        appointment = self.env['hms.appointment'].browse(appointment_id)
        if not appointment.exists():
            _logger.warning("Appointment not found: ID=%s", appointment_id)
            return {'success': False, 'error': 'Appointment not found'}

        try:
            appointments_field = f'wk{week_number}_appointment_ids'
            current_appointments = getattr(line, appointments_field)

            # Remove appointment from the Many2many relation
            if appointment_id in current_appointments.ids:
                line.write({appointments_field: [(3, appointment_id)]})
                _logger.info(
                    "Appointment removed from week: Line=%s, Week=%s, Appointment=%s",
                    line_id, week_number, appointment_id
                )

            # Clear treatment schedule info from appointment
            appointment_vals = {'treatment_schedule_line_id': False}

            # Only clear treatment_week if the field exists
            if hasattr(appointment, 'treatment_week'):
                appointment_vals['treatment_week'] = False

            appointment.write(appointment_vals)

            return {
                'success': True,
                'line': self.get_line_data(line_id),
                'appointments_count': len(getattr(line, appointments_field))
            }
        except Exception as e:
            _logger.error("Error removing appointment from week: %s", str(e))
            return {'success': False, 'error': str(e)}


    @api.model
    def get_available_appointments(self, patient_id=None):
        """Get available appointments for linking"""
        _logger.info("Getting available appointments for patient: %s", patient_id)

        domain = [('state', 'not in', ['canceled', 'done'])]
        if patient_id:
            domain.append(('patient_id', '=', int(patient_id)))

        appointments = self.env['hms.appointment'].search(domain, limit=100)

        result = [{
            'id': app.id,
            'name': app.name,
            'date': str(app.date) if app.date else '',
            'time': app.appointment_time if hasattr(app, 'appointment_time') else '',
            'patient_id': app.patient_id.id,
            'patient_name': app.patient_id.name,
            'physician_id': app.physician_id.id if app.physician_id else None,
            'physician_name': app.physician_id.name if app.physician_id else '',
            'state': app.state,
        } for app in appointments]

        _logger.info("Found %d available appointments", len(result))
        return result