# -*- coding: utf-8 -*-
import logging
from odoo import fields, models, api, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class HmsTreatmentSchedule(models.Model):
    _name = "hms.treatment.schedule"
    _description = "Treatment Schedule"
    _order = "date desc, id desc"

    name = fields.Char(
        string="Reference",
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: _("New"),
    )

    patient_id = fields.Many2one(
        "hms.patient",
        string="Patient",
        required=True,
        index=True,
        ondelete="cascade",
    )

    physician_id = fields.Many2one(
        "hms.physician",
        string="Physician",
        index=True,
    )

    date = fields.Date(
        string="Date",
        required=True,
        default=fields.Date.context_today,
    )

    total_weeks = fields.Selection(
        selection=[(str(i), str(i)) for i in range(1, 11)],
        string="Total Weeks",
        required=True,
        default='1',
        help="Number of weeks for this treatment schedule"
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], string="Status", default='draft')

    notes = fields.Text(string="Notes")

    special_instructions = fields.Text(string="Special Instructions")

    line_ids = fields.One2many(
        "hms.treatment.schedule.line",
        "schedule_id",
        string="Sessions",
        copy=True,
    )

    company_id = fields.Many2one(
        "res.company",
        string="Company",
        default=lambda self: self.env.company,
        required=True,
        index=True,
    )

    # Computed fields for display
    patient_name = fields.Char(
        related="patient_id.name",
        string="Patient Name",
        store=True,
    )

    physician_name = fields.Char(
        related="physician_id.name",
        string="Physician Name",
        store=True,
    )

    total_sessions = fields.Integer(
        string="Total Sessions",
        compute="_compute_total_sessions",
        store=True,
    )

    total_appointments = fields.Integer(
        string="Total Appointments",
        compute="_compute_total_appointments",
        store=True,
    )

    @api.depends('line_ids')
    def _compute_total_sessions(self):
        for rec in self:
            rec.total_sessions = len(rec.line_ids)

    @api.depends('line_ids.wk1_appointments_count', 'line_ids.wk2_appointments_count',
                 'line_ids.wk3_appointments_count', 'line_ids.wk4_appointments_count',
                 'line_ids.wk5_appointments_count', 'line_ids.wk6_appointments_count',
                 'line_ids.wk7_appointments_count', 'line_ids.wk8_appointments_count',
                 'line_ids.wk9_appointments_count', 'line_ids.wk10_appointments_count')
    def _compute_total_appointments(self):
        for rec in self:
            total = 0
            for line in rec.line_ids:
                total += (line.wk1_appointments_count + line.wk2_appointments_count +
                          line.wk3_appointments_count + line.wk4_appointments_count +
                          line.wk5_appointments_count + line.wk6_appointments_count +
                          line.wk7_appointments_count + line.wk8_appointments_count +
                          line.wk9_appointments_count + line.wk10_appointments_count)
            rec.total_appointments = total
            _logger.debug("Total appointments computed for schedule %s: %d", rec.name, total)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _('New')) == _('New'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'hms.treatment.schedule'
                ) or _('New')
        records = super().create(vals_list)
        for rec in records:
            _logger.info(
                "Treatment Schedule Created: ID=%s, Name=%s, Patient=%s, Physician=%s, Date=%s, Weeks=%s",
                rec.id, rec.name, rec.patient_id.name, rec.physician_id.name if rec.physician_id else 'N/A', rec.date,
                rec.total_weeks
            )
        return records

    def write(self, vals):
        result = super().write(vals)
        for rec in self:
            _logger.info(
                "Treatment Schedule Updated: ID=%s, Name=%s, Fields Updated=%s",
                rec.id, rec.name, list(vals.keys())
            )
        return result

    def unlink(self):
        for rec in self:
            _logger.info(
                "Treatment Schedule Deleted: ID=%s, Name=%s, Patient=%s",
                rec.id, rec.name, rec.patient_id.name
            )
        return super().unlink()

    def action_set_draft(self):
        self.ensure_one()
        self.state = 'draft'
        _logger.info("Treatment Schedule %s set to Draft", self.name)

    def action_set_in_progress(self):
        self.ensure_one()
        self.state = 'in_progress'
        _logger.info("Treatment Schedule %s set to In Progress", self.name)

    def action_set_completed(self):
        self.ensure_one()
        self.state = 'completed'
        _logger.info("Treatment Schedule %s set to Completed", self.name)

    def action_set_cancelled(self):
        self.ensure_one()
        self.state = 'cancelled'
        _logger.info("Treatment Schedule %s set to Cancelled", self.name)

    def action_open_treatment_schedule_view(self):
        """Open the custom JavaScript Treatment Schedule View"""
        self.ensure_one()
        _logger.info(
            "Opening Treatment Schedule View: ID=%s, Name=%s, Weeks=%s",
            self.id, self.name, self.total_weeks
        )
        return {
            'type': 'ir.actions.client',
            'tag': 'treatment_schedule_view',
            'name': _('Treatment Schedule: %s') % self.name,
            'params': {
                'schedule_id': self.id,
            },
            'context': {
                'active_id': self.id,
                'default_schedule_id': self.id,
            },
        }

    def action_print_treatment_schedule(self):
        """Print the treatment schedule report"""
        self.ensure_one()
        _logger.info(
            "Printing Treatment Schedule Report: ID=%s, Name=%s",
            self.id, self.name
        )
        return self.env.ref(
            'hms_treatment_schedule.action_report_treatment_schedule'
        ).report_action(self)

    def action_view_calendar(self):
        """Dummy method to satisfy statusbar widget"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Calendar',
            'res_model': 'hms.treatment.schedule',
            'view_mode': 'calendar',
            'res_id': self.id,
            'target': 'current',
        }

    def action_view_graph(self):
        """Dummy method to satisfy statusbar widget"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Graph',
            'res_model': 'hms.treatment.schedule',
            'view_mode': 'graph',
            'res_id': self.id,
            'target': 'current',
        }

    @api.model
    def get_schedule_data(self, schedule_id):
        """Get treatment schedule data for JavaScript view"""
        _logger.info("=" * 50)
        _logger.info("MODEL: get_schedule_data called with schedule_id=%s", schedule_id)

        schedule = self.browse(int(schedule_id))
        if not schedule.exists():
            _logger.error("ERROR: Schedule not found: ID=%s", schedule_id)
            _logger.info("=" * 50)
            return {}

        # Get session types (products)
        session_types = []
        for line in schedule.line_ids:
            session_data = {
                'id': line.id,
                'sequence': line.sequence,
                'product_id': line.product_id.id,
                'product_name': line.product_id.display_name,
            }

            # Add week data dynamically based on total_weeks
            total_weeks = int(schedule.total_weeks)
            for week_num in range(1, total_weeks + 1):
                date_field = f'wk{week_num}_date'
                number_field = f'wk{week_num}_number'
                appointments_field = f'wk{week_num}_appointment_ids'
                count_field = f'wk{week_num}_appointments_count'

                if hasattr(line, date_field):
                    session_data[f'wk{week_num}_date'] = str(getattr(line, date_field)) if getattr(line,
                                                                                                   date_field) else ''
                else:
                    session_data[f'wk{week_num}_date'] = ''

                if hasattr(line, number_field):
                    session_data[f'wk{week_num}_number'] = getattr(line, number_field) or ''
                else:
                    session_data[f'wk{week_num}_number'] = ''

                if hasattr(line, count_field):
                    session_data[f'wk{week_num}_appointments_count'] = getattr(line, count_field) or 0
                else:
                    session_data[f'wk{week_num}_appointments_count'] = 0

                # Get appointments details - FIXED: Check if field exists and has appointments
                appointments_list = []
                if hasattr(line, appointments_field):
                    appointments = getattr(line, appointments_field)
                    if appointments:
                        for app in appointments:
                            try:
                                appointment_data = {
                                    'id': app.id,
                                    'name': app.name or '',
                                    'date': str(app.date) if app.date else '',
                                    'state': app.state or '',
                                    'patient_id': app.patient_id.id if app.patient_id else None,
                                    'patient_name': app.patient_id.name if app.patient_id else '',
                                }

                                # Add physician info if available
                                if hasattr(app, 'physician_id') and app.physician_id:
                                    appointment_data['physician_id'] = app.physician_id.id
                                    appointment_data['physician_name'] = app.physician_id.name
                                else:
                                    appointment_data['physician_id'] = None
                                    appointment_data['physician_name'] = ''

                                appointments_list.append(appointment_data)
                            except Exception as e:
                                _logger.error("Error processing appointment %s: %s", app.id if app else 'unknown',
                                              str(e))
                                continue

                session_data[f'wk{week_num}_appointments'] = appointments_list
                _logger.debug("Week %s has %d appointments", week_num, len(appointments_list))

            session_types.append(session_data)
            _logger.debug("Added session type %s with %d appointments total",
                          line.product_id.display_name,
                          sum([len(session_data.get(f'wk{i}_appointments', [])) for i in range(1, total_weeks + 1)]))

        # Generate dynamic weeks list
        total_weeks = int(schedule.total_weeks)
        weeks_list = [f'WK{i}' for i in range(1, total_weeks + 1)]

        data = {
            'id': schedule.id,
            'name': schedule.name,
            'state': schedule.state,
            'date': str(schedule.date) if schedule.date else '',
            'total_weeks': schedule.total_weeks,
            'weeks_list': weeks_list,
            'patient_id': schedule.patient_id.id,
            'patient_name': schedule.patient_id.name,
            'physician_id': schedule.physician_id.id if schedule.physician_id else None,
            'physician_name': schedule.physician_id.name if schedule.physician_id else '',
            'notes': schedule.notes or '',
            'special_instructions': schedule.special_instructions or '',
            'session_types': session_types,
            'total_sessions': schedule.total_sessions,
            'total_appointments': schedule.total_appointments or 0,
        }

        _logger.info("SUCCESS: Schedule data fetched")
        _logger.info("Schedule ID: %s", data['id'])
        _logger.info("Schedule Name: %s", data['name'])
        _logger.info("Total Weeks: %s", data['total_weeks'])
        _logger.info("Patient: %s", data['patient_name'])
        _logger.info("Session types count: %d", len(session_types))
        _logger.info("Total appointments: %d", data['total_appointments'])

        # Log appointments count for debugging
        for st in session_types:
            for week in range(1, total_weeks + 1):
                appointments = st.get(f'wk{week}_appointments', [])
                if appointments:
                    _logger.debug("Session %s WK%d has %d appointments: %s",
                                  st['product_name'], week, len(appointments),
                                  [a['name'] for a in appointments])

        _logger.info("=" * 50)

        return data

    @api.model
    def update_schedule_field(self, schedule_id, field_name, value):
        """Update a single field on the treatment schedule"""
        _logger.info("=" * 50)
        _logger.info("MODEL: update_schedule_field called")
        _logger.info("schedule_id=%s, field_name=%s, value=%s",
                     schedule_id, field_name, value)

        schedule = self.browse(int(schedule_id))
        if not schedule.exists():
            _logger.error("ERROR: Schedule not found: ID=%s", schedule_id)
            _logger.info("=" * 50)
            return {'success': False, 'error': 'Schedule not found'}

        allowed_fields = ['notes', 'special_instructions', 'physician_id', 'date', 'state', 'total_weeks']
        if field_name not in allowed_fields:
            _logger.error("ERROR: Field not allowed: %s", field_name)
            _logger.info("=" * 50)
            return {'success': False, 'error': 'Field not allowed'}

        try:
            schedule.write({field_name: value})
            _logger.info("SUCCESS: Schedule field updated")
            _logger.info("=" * 50)
            return {'success': True}
        except Exception as e:
            _logger.error("EXCEPTION: Error updating schedule field: %s", str(e))
            _logger.info("=" * 50)
            return {'success': False, 'error': str(e)}

    @api.model
    def get_available_products(self):
        """Get available products for session types"""
        _logger.info("=" * 50)
        _logger.info("MODEL: get_available_products called")

        products = self.env['product.product'].search([
            ('active', '=', True),
            ('company_id', 'in', [self.env.company.id, False]),
        ], order='name')

        result = [{
            'id': p.id,
            'name': p.display_name,
        } for p in products]

        _logger.info("SUCCESS: Found %d available products", len(result))
        _logger.info("=" * 50)
        return result

    @api.model
    def get_available_physicians(self):
        """Get available physicians"""
        _logger.info("=" * 50)
        _logger.info("MODEL: get_available_physicians called")

        physicians = self.env['hms.physician'].search([
            ('active', '=', True),
        ], order='name')

        result = [{
            'id': p.id,
            'name': p.name,
        } for p in physicians]

        _logger.info("SUCCESS: Found %d available physicians", len(result))
        _logger.info("=" * 50)
        return result

    @api.model
    def get_available_appointments(self, patient_id=None):
        """Get available appointments for linking"""
        _logger.info("=" * 50)
        _logger.info("MODEL: get_available_appointments called")
        _logger.info("Patient ID: %s", patient_id)

        result = self.env['hms.treatment.schedule.line'].get_available_appointments(patient_id)

        _logger.info("SUCCESS: Found %d available appointments", len(result))
        _logger.info("=" * 50)
        return result

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        _logger.info("Default get called for fields: %s", fields_list)

        # Only create default lines if line_ids is empty
        if "line_ids" in fields_list and not res.get("line_ids"):
            session_names = [
                "Dry Needle",
                "Shockwave Therapy",
                "Spine Decompression",
                "Rehab Session",
                "Laser Therapy",
                "Therapeutic Massage",
                "Cryotherapy",
                "Electrotherapy",
                "Neuro Session",
                "Pediatrics Session",
            ]

            ProductT = self.env["product.template"].sudo()
            lines = []
            missing = []

            for seq, name in enumerate(session_names, start=1):
                tmpl = False

                # 1) exact match + company
                tmpl = ProductT.search([
                    ("name", "=", name),
                    ("active", "=", True),
                    ("company_id", "in", [self.env.company.id, False]),
                ], limit=1)

                # 2) fallback ilike + company
                if not tmpl:
                    tmpl = ProductT.search([
                        ("name", "ilike", name),
                        ("active", "=", True),
                        ("company_id", "in", [self.env.company.id, False]),
                    ], limit=1)

                # 3) fallback ilike without company filter
                if not tmpl:
                    tmpl = ProductT.search([
                        ("name", "ilike", name),
                        ("active", "=", True),
                    ], limit=1)

                # Convert template to variant product.product
                product = tmpl.product_variant_id if tmpl else False

                if product:
                    lines.append((0, 0, {
                        "sequence": seq,
                        "product_id": product.id,
                    }))
                else:
                    missing.append(name)

            res["line_ids"] = lines

            if missing:
                _logger.warning(
                    "HMS Treatment Schedule - Missing session products: %s",
                    missing
                )

        return res