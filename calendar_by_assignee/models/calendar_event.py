# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from collections import defaultdict
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


class AppointmentCalendar(models.Model):
    _inherit = 'hms.appointment'

    # Add calendar-specific fields
    appointment_status = fields.Selection([
        ('draft', 'Draft'),
        ('no_answer', 'No Answer'),
        ('call_back', 'Call Back'),
        ('posponed', 'Postponed'),
        ('confirm', 'Confirmed'),
        ('booked', 'Booked'),
        ('arrived', 'Arrived'),
        ('waiting', 'Waiting'),
        ('treatment', 'Treatment'),
        ('in_consultation', 'In Consultation'),
        ('basic_7_floor', 'Basic 7th Floor'),
        ('pause', 'Paused'),
        ('to_invoice', 'To Invoice'),
        ('gig_insurance', 'GIG Insurance'),
        ('billed', 'Billed'),
        ('done', 'Done'),
        ('cancelled', 'Cancelled'),
        ('blocked', 'Blocked'),
        ('follow_up', 'Follow Up'),
        ('feels_good', 'Feels Good'),
    ], string='Appointment Status', related='state', store=True)

    # Treatment Schedule Fields
    treatment_schedule_id = fields.Many2one(
        'hms.treatment.schedule',
        string='Treatment Schedule',
        ondelete='set null'
    )

    treatment_schedule_line_id = fields.Many2one(
        'hms.treatment.schedule.line',
        string='Treatment Schedule Line',
        ondelete='set null',
        tracking=True
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

    consultation_type = fields.Selection([
        ('consultation', 'Consultation'),
        ('followup', 'Follow Up'),
        ('treatment_schedule', 'Treatment Schedule'),
    ], string='Consultation Type', default='consultation', tracking=True)

    # Calendar display fields
    start = fields.Datetime(string='Start', compute='_compute_calendar_dates', store=True)
    stop = fields.Datetime(string='Stop', compute='_compute_calendar_dates', store=True)
    allday = fields.Boolean(string='All Day', default=False)
    duration = fields.Float(string='Duration', compute='_compute_duration', store=True)

    # Override partner_ids to use patient
    partner_ids = fields.Many2many('res.partner', string='Attendees',
                                   compute='_compute_partner_ids', store=True)

    # Use physician as the assignee
    doctor_id = fields.Many2one('hms.physician', string='Doctor', related='physician_id', store=True)

    # Description from appointment notes
    description = fields.Text(string='Description', related='notes', store=True)

    def _get_appointment_data_for_calendar(self):
        """Get appointment data for calendar display"""
        for appointment in self:
            yield {
                'id': appointment.id,
                'name': appointment.name or 'Appointment',
                'start': appointment.date,
                'stop': appointment.date_to or appointment.date + timedelta(hours=1),
                'duration': appointment.duration,
                'doctor_id': appointment.physician_id.id if appointment.physician_id else None,
                'appointment_status': appointment.state,
                'doctor_name': appointment.physician_id.name if appointment.physician_id else '',
                'doctor_code': appointment.physician_id.code or '',
                'doctor_specialty': appointment.department_id.name or 'No Department',
                'patient_name': appointment.patient_id.name if appointment.patient_id else '',
                'patient_gender': appointment.patient_id.gender if appointment.patient_id else None,
                'cabin_name': appointment.cabin_id.name if appointment.cabin_id else '',
                'cabin_id': appointment.cabin_id.id if appointment.cabin_id else None,
                'consultation_type': appointment.consultation_type or 'consultation',
                'treatment_schedule_id': appointment.treatment_schedule_id.id if appointment.treatment_schedule_id else None,
                'treatment_schedule_line_id': appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else None,
                'treatment_week': appointment.treatment_week or '',
                'notes': appointment.notes or '',  # ADDED: notes field
            }

    def get_treatment_schedule_line_data(self):
        """Get treatment schedule line data for frontend"""
        self.ensure_one()
        if not self.treatment_schedule_line_id:
            return {}

        line = self.treatment_schedule_line_id
        week_data = {}
        for week in range(1, 9):
            date_field = f'wk{week}_date'
            number_field = f'wk{week}_number'
            if getattr(line, date_field) or getattr(line, number_field):
                week_data = {
                    'week_number': week,
                    'date': getattr(line, date_field),
                    'number': getattr(line, number_field),
                    'session_type_id': line.product_id.id if line.product_id else None,
                    'session_type_name': line.product_id.name if line.product_id else '',
                }
                break

        return week_data

    def check_cabin_appointment_conflict(self, cabin_id, start_datetime, end_datetime, patient_gender=None,
                                         exclude_appointment_id=None):
        """Check if cabin has appointment conflict with gender validation"""
        try:
            _logger.info(
                "🔍 Cabin conflict check - cabin_id: %s (type: %s), start: %s, end: %s, patient_gender: %s, exclude_appointment_id: %s",
                cabin_id, type(cabin_id), start_datetime, end_datetime, patient_gender, exclude_appointment_id)

            if isinstance(cabin_id, str) and ('-' in cabin_id or ':' in cabin_id):
                _logger.warning("⚠️ Parameters are misaligned. Manual reordering...")

                all_params = [cabin_id, start_datetime, end_datetime, patient_gender, exclude_appointment_id]

                new_cabin_id = None
                for param in all_params:
                    if param is None:
                        continue
                    if isinstance(param, (int, float)) or (isinstance(param, str) and param.isdigit()):
                        try:
                            new_cabin_id = int(param)
                            _logger.info("Found cabin_id: %s", new_cabin_id)
                            break
                        except:
                            continue

                if new_cabin_id is None:
                    for param in all_params:
                        if param is None:
                            continue
                        if isinstance(param, (int, float)) or (isinstance(param, str) and param.isdigit()):
                            try:
                                new_cabin_id = int(param)
                                _logger.info("Found cabin_id in exclude_appointment_id: %s", new_cabin_id)
                                break
                            except:
                                continue

                dates = []
                for param in all_params:
                    if param is None:
                        continue
                    if isinstance(param, str) and '-' in param and ':' in param:
                        dates.append(param)

                new_start = dates[0] if len(dates) > 0 else None
                new_end = dates[1] if len(dates) > 1 else None

                new_gender = None
                for param in all_params:
                    if param is None:
                        continue
                    if isinstance(param, str) and param in ['male', 'female']:
                        new_gender = param
                        break

                new_exclude = None
                for param in all_params:
                    if param is None:
                        continue
                    if isinstance(param, (int, float)) or (isinstance(param, str) and param.isdigit()):
                        try:
                            param_int = int(param)
                            if new_cabin_id is None or param_int != new_cabin_id:
                                new_exclude = param_int
                                _logger.info("Found exclude_appointment_id: %s", new_exclude)
                                break
                        except:
                            continue

                if new_cabin_id is None:
                    _logger.error("❌ Could not find cabin_id in parameters")
                    return {
                        'hasConflict': True,
                        'genderConflict': False,
                        'message': 'Invalid cabin ID. Could not determine cabin from parameters.'
                    }

                cabin_id = new_cabin_id
                if new_start:
                    start_datetime = new_start
                if new_end:
                    end_datetime = new_end
                if new_gender:
                    patient_gender = new_gender
                if new_exclude:
                    exclude_appointment_id = new_exclude

                _logger.info("✅ Reordered parameters - cabin_id: %s, start: %s, end: %s, gender: %s, exclude: %s",
                             cabin_id, start_datetime, end_datetime, patient_gender, exclude_appointment_id)

            try:
                cabin_id = int(cabin_id)
            except (ValueError, TypeError) as e:
                _logger.error("❌ Invalid cabin_id: %s (type: %s). Error: %s",
                              cabin_id, type(cabin_id), str(e))
                return {
                    'hasConflict': True,
                    'genderConflict': False,
                    'message': f'Invalid cabin ID: {cabin_id}. Expected a number.'
                }

            if isinstance(start_datetime, str):
                start_dt = fields.Datetime.from_string(start_datetime)
            else:
                start_dt = start_datetime

            if isinstance(end_datetime, str):
                end_dt = fields.Datetime.from_string(end_datetime)
            else:
                end_dt = end_datetime

            if not start_dt or not end_dt:
                _logger.error("❌ Invalid dates: start=%s, end=%s", start_datetime, end_datetime)
                return {
                    'hasConflict': False,
                    'genderConflict': False,
                    'message': 'Invalid date range provided.'
                }

            domain = [
                ('cabin_id', '=', cabin_id),
                ('date', '<', end_dt),
                ('date_to', '>', start_dt),
                ('state', 'in', ['draft', 'confirm', 'booked', 'arrived', 'waiting', 'treatment',
                                 'in_consultation', 'done', 'pause', 'follow_up'])
            ]

            if exclude_appointment_id:
                try:
                    exclude_id = int(exclude_appointment_id)
                    domain.append(('id', '!=', exclude_id))
                    _logger.info("Excluding appointment ID: %s", exclude_id)
                except (ValueError, TypeError) as e:
                    _logger.warning("Invalid exclude_appointment_id: %s. Error: %s", exclude_appointment_id, str(e))

            overlapping_appointments = self.search(domain)

            _logger.info("Found %s overlapping appointments for cabin %s", len(overlapping_appointments), cabin_id)

            if not overlapping_appointments:
                return {
                    'hasConflict': False,
                    'genderConflict': False,
                    'message': 'Cabin is available'
                }

            conflicting_appointments = []
            for appointment in overlapping_appointments:
                if appointment.patient_id and appointment.patient_id.gender:
                    appointment_gender = appointment.patient_id.gender

                    if patient_gender and patient_gender != appointment_gender:
                        gender_map = {'male': 'Male', 'female': 'Female'}
                        conflicting_appointments.append({
                            'id': appointment.id,
                            'name': appointment.name,
                            'patient_name': appointment.patient_id.name,
                            'patient_gender': appointment_gender
                        })

            if conflicting_appointments:
                conflict_messages = []
                for conf_app in conflicting_appointments:
                    conflict_messages.append(
                        f"{conf_app['name']} (Patient: {conf_app['patient_name']}, Gender: {gender_map.get(conf_app['patient_gender'], conf_app['patient_gender'])})"
                    )

                error_message = f'Gender conflict: Cabin has appointments with different gender patients: {", ".join(conflict_messages)}'
                return {
                    'hasConflict': True,
                    'genderConflict': True,
                    'conflictingAppointments': conflicting_appointments,
                    'message': error_message,
                    'detailedMessage': error_message
                }

            _logger.info("✅ Same gender appointments allowed in cabin %s", cabin_id)
            return {
                'hasConflict': False,
                'genderConflict': False,
                'message': 'Same gender appointments allowed'
            }

        except Exception as e:
            _logger.error("❌ Error in cabin conflict check: %s", str(e), exc_info=True)
            return {
                'hasConflict': True,
                'genderConflict': False,
                'message': f'Error checking cabin availability: {str(e)}'
            }

    def link_to_treatment_schedule(self, line_id, week_number, week_number_details):
        """Link appointment to treatment schedule line and week"""
        try:
            line = self.env['hms.treatment.schedule.line'].browse(line_id)
            if not line.exists():
                _logger.error("Treatment schedule line not found: %s", line_id)
                return False

            # Update week field based on week number
            week_field = f'wk{week_number}_number'
            if hasattr(line, week_field):
                line.write({
                    week_field: week_number_details
                })
                _logger.info("Updated week %s for line %s: %s", week_number, line_id, week_number_details)

            # Link appointment to treatment schedule
            self.write({
                'treatment_schedule_id': line.schedule_id.id,
                'treatment_schedule_line_id': line.id,
                'treatment_week': str(week_number),
                'consultation_type': 'treatment_schedule'
            })

            _logger.info("Appointment %s linked to treatment schedule line %s, week %s",
                        self.id, line_id, week_number)
            return True

        except Exception as e:
            _logger.error("Error linking to treatment schedule: %s", str(e))
            return False

    @api.model
    def create(self, vals):
        """Override create to validate gap and overlap and handle timezone conversion"""
        _logger.info("📝 Creating appointment with initial values: %s", vals)

        if 'notes' in vals:
            _logger.info("📝 LOG: Creating appointment with notes: %s", vals['notes'])

        if 'date' in vals and vals['date']:
            date_str = vals['date']
            if isinstance(date_str, str):
                date_dt = fields.Datetime.from_string(date_str)
                _logger.info("📝 LOG: Original local start time: %s", date_str)
                date_dt = date_dt - timedelta(hours=3)
                vals['date'] = fields.Datetime.to_string(date_dt)
                _logger.info("📝 LOG: Converted UTC start time: %s", vals['date'])

        if 'date_to' in vals and vals['date_to']:
            date_to_str = vals['date_to']
            if isinstance(date_to_str, str):
                date_to_dt = fields.Datetime.from_string(date_to_str)
                _logger.info("📝 LOG: Original local end time: %s", date_to_str)
                date_to_dt = date_to_dt - timedelta(hours=3)
                vals['date_to'] = fields.Datetime.to_string(date_to_dt)
                _logger.info("📝 LOG: Converted UTC end time: %s", vals['date_to'])

        # Handle treatment schedule linking
        treatment_schedule_id = vals.get('treatment_schedule_id')
        treatment_schedule_line_id = vals.get('treatment_schedule_line_id')
        treatment_week = vals.get('treatment_week')
        week_number_details = vals.pop('week_number_details', None)  # Extract week number details

        appointment = super(AppointmentCalendar, self).create(vals)

        # Link to treatment schedule if needed
        if treatment_schedule_line_id and treatment_week and week_number_details:
            appointment.link_to_treatment_schedule(
                treatment_schedule_line_id,
                int(treatment_week),
                week_number_details
            )

        if 'cabin_id' in vals and 'patient_id' in vals:
            patient = self.env['hms.patient'].browse(vals['patient_id'])
            patient_gender = patient.gender if patient else None

            cabin_conflict = appointment.check_cabin_appointment_conflict(
                vals.get('cabin_id'),
                vals.get('date'),
                vals.get('date_to'),
                patient_gender,
                appointment.id
            )

            if cabin_conflict and cabin_conflict['hasConflict']:
                if cabin_conflict['genderConflict']:
                    raise ValidationError(
                        f"Cannot schedule appointment: Gender conflict in consultation room.\n"
                        f"Existing appointment: {cabin_conflict['conflictingAppointment']}"
                    )
                else:
                    raise ValidationError(
                        f"Cannot schedule appointment: Cabin already has appointments at this time.\n"
                        f"Existing appointment: {cabin_conflict['conflictingAppointment']}"
                    )

        _logger.info("✅ LOG: Appointment created successfully with ID: %s, Treatment Schedule Line ID: %s, Treatment Week: %s, Notes: %s",
                     appointment.id,
                     appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else 'None',
                     appointment.treatment_week or 'None',
                     appointment.notes or 'None')
        return appointment

    def write(self, vals):
        """Override write to validate gap and overlap and handle timezone conversion"""
        _logger.info("📝 Updating appointment %s with values: %s", self.ids, vals)

        if 'notes' in vals:
            _logger.info("📝 LOG: Updating appointment notes: %s", vals['notes'])

        if 'date' in vals and vals['date']:
            date_str = vals['date']
            if isinstance(date_str, str):
                date_dt = fields.Datetime.from_string(date_str)
                _logger.info("📝 LOG: Original local start time: %s", date_str)
                date_dt = date_dt - timedelta(hours=3)
                vals['date'] = fields.Datetime.to_string(date_dt)
                _logger.info("📝 LOG: Converted UTC start time: %s", vals['date'])

        if 'date_to' in vals and vals['date_to']:
            date_to_str = vals['date_to']
            if isinstance(date_to_str, str):
                date_to_dt = fields.Datetime.from_string(date_to_str)
                _logger.info("📝 LOG: Original local end time: %s", date_to_str)
                date_to_dt = date_to_dt - timedelta(hours=3)
                vals['date_to'] = fields.Datetime.to_string(date_to_dt)
                _logger.info("📝 LOG: Converted UTC end time: %s", vals['date_to'])

        for appointment in self:
            physician_id = vals.get('physician_id', appointment.physician_id.id)
            date = vals.get('date', appointment.date)
            date_to = vals.get('date_to', appointment.date_to)
            cabin_id = vals.get('cabin_id', appointment.cabin_id.id)
            patient_id = vals.get('patient_id', appointment.patient_id.id)

            if ('cabin_id' in vals or 'patient_id' in vals) and cabin_id:
                patient = self.env['hms.patient'].browse(patient_id)
                patient_gender = patient.gender if patient else None

                cabin_conflict = appointment.check_cabin_appointment_conflict(
                    cabin_id,
                    date,
                    date_to,
                    patient_gender,
                    appointment.id
                )

                if cabin_conflict and cabin_conflict['hasConflict']:
                    if cabin_conflict['genderConflict']:
                        conflict_info = ""
                        if cabin_conflict.get('conflictingAppointments'):
                            for app in cabin_conflict['conflictingAppointments']:
                                conflict_info += f"\n- {app['name']} (Patient: {app['patient_name']})"

                        raise ValidationError(
                            f"Cannot schedule appointment: Gender conflict in consultation room.{conflict_info}"
                        )
                    else:
                        raise ValidationError(
                            f"Cannot schedule appointment: Cabin already has appointments at this time."
                        )

        result = super(AppointmentCalendar, self).write(vals)

        for appointment in self:
            _logger.info("✅ LOG: Appointment %s updated successfully, Treatment Schedule Line ID: %s, Treatment Week: %s, Notes: %s",
                         appointment.id,
                         appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else 'None',
                         appointment.treatment_week or 'None',
                         appointment.notes or 'None')

        return result

    @api.depends('date', 'date_to')
    def _compute_calendar_dates(self):
        """Compute start and stop dates for calendar display"""
        for record in self:
            record.start = record.date
            record.stop = record.date_to or record.date + timedelta(hours=1)

    @api.depends('date', 'date_to')
    def _compute_duration(self):
        """Compute duration in hours for calendar display"""
        for record in self:
            if record.date and record.date_to:
                diff = record.date_to - record.date
                record.duration = diff.total_seconds() / 3600.0
            else:
                record.duration = 1.0

    @api.depends('patient_id')
    def _compute_partner_ids(self):
        """Compute partner_ids from patient"""
        for record in self:
            if record.patient_id and record.patient_id.partner_id:
                record.partner_ids = [(6, 0, [record.patient_id.partner_id.id])]
            else:
                record.partner_ids = [(5, 0, 0)]

    @api.model
    def get_calendar_events_by_assignee(self, start_datetime, end_datetime, physician_ids):
        """Get appointments for calendar display - normalizing timezone"""
        try:
            _logger.info("Getting calendar events by assignee - Input: start=%s, end=%s, physicians=%s",
                         start_datetime, end_datetime, physician_ids)

            if isinstance(start_datetime, str):
                start_dt = fields.Datetime.from_string(start_datetime)
            else:
                start_dt = start_datetime

            if isinstance(end_datetime, str):
                end_dt = fields.Datetime.from_string(end_datetime)
            else:
                end_dt = end_datetime

            physician_ids = [int(pid) for pid in physician_ids]

            appointments = self.search([
                ('date', '>=', start_dt),
                ('date', '<=', end_dt),
                ('physician_id', 'in', physician_ids)
            ])

            _logger.info("Found %s appointments for physicians %s in range %s to %s",
                         len(appointments), physician_ids, start_datetime, end_datetime)

            result = defaultdict(list)
            for appointment in appointments:
                if appointment.physician_id and appointment.physician_id.id in physician_ids:
                    partner_names = []
                    patient_name = ""
                    patient_phone = ""
                    patient_mobile = ""
                    patient_id = None
                    patient_gender = None

                    if appointment.patient_id:
                        patient_id = appointment.patient_id.id
                        patient_name = appointment.patient_id.name
                        patient_gender = appointment.patient_id.gender
                        if appointment.patient_id.partner_id:
                            partner_names = [appointment.patient_id.partner_id.name]
                        patient_phone = appointment.patient_id.phone or ""
                        patient_mobile = appointment.patient_id.mobile or ""

                    local_start = appointment.date
                    local_stop = appointment.date_to or appointment.date + timedelta(hours=1)

                    if appointment.date:
                        local_start = appointment.date + timedelta(hours=3)
                        _logger.debug("Appointment %s - UTC start: %s, Local start: %s",
                                      appointment.id, appointment.date, local_start)

                    if appointment.date_to:
                        local_stop = appointment.date_to + timedelta(hours=3)
                        _logger.debug("Appointment %s - UTC end: %s, Local end: %s",
                                      appointment.id, appointment.date_to, local_stop)
                    else:
                        local_stop = local_start + timedelta(hours=1)

                    event_data = {
                        'id': appointment.id,
                        'name': appointment.name or 'Appointment',
                        'start': local_start.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_start,
                                                                                         datetime) else local_start,
                        'stop': local_stop.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_stop,
                                                                                       datetime) else local_stop,
                        'duration': appointment.duration,
                        'doctor_id': appointment.physician_id.id,
                        'appointment_status': appointment.state,
                        'doctor_name': appointment.physician_id.name,
                        'doctor_code': appointment.physician_id.code or '',
                        'doctor_specialty': appointment.department_id.name or 'No Department',
                        'partner_names': partner_names,
                        'patient_name': patient_name,
                        'patient_phone': patient_phone,
                        'patient_mobile': patient_mobile,
                        'patient_id': [patient_id, patient_name] if patient_id else None,
                        'patient_gender': patient_gender,
                        'cabin_name': appointment.cabin_id.name if appointment.cabin_id else '',
                        'cabin_id': appointment.cabin_id.id if appointment.cabin_id else None,
                        'color_index': self._get_appointment_color(appointment.state),
                        'is_all_day': False,
                        'description': appointment.notes or '',
                        'consultation_type': appointment.consultation_type or 'consultation',
                        'treatment_schedule_id': appointment.treatment_schedule_id.id if appointment.treatment_schedule_id else None,
                        'treatment_schedule_line_id': appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else None,
                        'treatment_week': appointment.treatment_week or '',
                        'notes': appointment.notes or '',
                        'patient_code': appointment.patient_id.code if appointment.patient_id and appointment.patient_id.code else '',

                    }
                    result[appointment.physician_id.id].append(event_data)

            _logger.info("Returning %s events for %s physicians",
                         sum(len(v) for v in result.values()), len(result))
            return dict(result)

        except Exception as e:
            _logger.error("Error in get_calendar_events_by_assignee: %s", str(e))
            return {}

    @api.model
    def get_calendar_events_by_cabin(self, start_datetime, end_datetime, cabin_ids):
        """Get appointments for calendar display grouped by cabin - normalizing timezone"""
        try:
            _logger.info("Getting calendar events by cabin - Input: start=%s, end=%s, cabins=%s",
                         start_datetime, end_datetime, cabin_ids)

            if isinstance(start_datetime, str):
                start_dt = fields.Datetime.from_string(start_datetime)
            else:
                start_dt = start_datetime

            if isinstance(end_datetime, str):
                end_dt = fields.Datetime.from_string(end_datetime)
            else:
                end_dt = end_datetime

            cabin_ids = [int(cid) for cid in cabin_ids]

            appointments = self.search([
                ('date', '>=', start_dt),
                ('date', '<=', end_dt),
                ('cabin_id', 'in', cabin_ids)
            ])

            _logger.info("Found %s appointments for cabins %s in range %s to %s",
                         len(appointments), cabin_ids, start_datetime, end_datetime)

            result = defaultdict(list)
            for appointment in appointments:
                if appointment.cabin_id and appointment.cabin_id.id in cabin_ids:
                    partner_names = [];
                    patient_name = ""
                    patient_phone = ""
                    patient_mobile = ""
                    patient_gender = None

                    if appointment.patient_id:
                        patient_name = appointment.patient_id.name
                        patient_gender = appointment.patient_id.gender
                        if appointment.patient_id.partner_id:
                            partner_names = [appointment.patient_id.partner_id.name]
                        patient_phone = appointment.patient_id.phone or ""
                        patient_mobile = appointment.patient_id.mobile or ""

                    local_start = appointment.date + timedelta(hours=3) if appointment.date else appointment.date
                    local_stop = appointment.date_to + timedelta(hours=3) if appointment.date_to else (
                        appointment.date + timedelta(hours=1) if appointment.date else None)

                    if appointment.date:
                        _logger.debug("Appointment %s - UTC start: %s, Local start: %s",
                                      appointment.id, appointment.date, local_start)

                    if appointment.date_to:
                        local_stop = appointment.date_to + timedelta(hours=3)
                        _logger.debug("Appointment %s - UTC end: %s, Local end: %s",
                                      appointment.id, appointment.date_to, local_stop)
                    else:
                        local_stop = local_start + timedelta(hours=1)

                    event_data = {
                        'id': appointment.id,
                        'name': appointment.name or 'Appointment',
                        'start': local_start.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_start,
                                                                                         datetime) else local_start,
                        'stop': local_stop.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_stop,
                                                                                       datetime) else local_stop,
                        'duration': appointment.duration,
                        'cabin_id': appointment.cabin_id.id,
                        'appointment_status': appointment.state,
                        'cabin_name': appointment.cabin_id.name,
                        'doctor_name': appointment.physician_id.name if appointment.physician_id else '',
                        'doctor_specialty': appointment.department_id.name if appointment.department_id else 'No Department',
                        'partner_names': partner_names,
                        'patient_name': patient_name,
                        'patient_code': appointment.patient_id.code if appointment.patient_id and appointment.patient_id.code else '',
                        'patient_phone': patient_phone,
                        'patient_mobile': patient_mobile,
                        'patient_gender': patient_gender,
                        'color_index': self._get_appointment_color(appointment.state),
                        'is_all_day': False,
                        'description': appointment.notes or '',
                        'consultation_type': appointment.consultation_type or 'consultation',
                        'treatment_schedule_id': appointment.treatment_schedule_id.id if appointment.treatment_schedule_id else None,
                        'treatment_schedule_line_id': appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else None,
                        'treatment_week': appointment.treatment_week or '',
                        'notes': appointment.notes or '',
                    }
                    result[appointment.cabin_id.id].append(event_data)

            _logger.info("Returning events for %s cabins", len(result))
            return dict(result)

        except Exception as e:
            _logger.error("Error in get_calendar_events_by_cabin: %s", str(e))
            return {}

    @api.model
    def get_week_events_by_assignee(self, week_start, physician_ids):
        """Get week appointments for calendar display - normalizing timezone"""
        try:
            _logger.info("Getting week events by assignee - Input: week_start=%s, physicians=%s",
                         week_start, physician_ids)

            if 'T' in week_start:
                week_start = week_start.split('T')[0]

            week_start_dt = datetime.strptime(week_start, '%Y-%m-%d')
            week_end = week_start_dt + timedelta(days=7)
            week_end_str = week_end.strftime('%Y-%m-%d 23:59:59')
            week_start_str = week_start_dt.strftime('%Y-%m-%d 00:00:00')

            physician_ids = [int(pid) for pid in physician_ids]

            appointments = self.search([
                ('date', '>=', week_start_str),
                ('date', '<=', week_end_str),
                ('physician_id', 'in', physician_ids)
            ])

            _logger.info("Found %s appointments for physicians %s in week starting %s",
                         len(appointments), physician_ids, week_start)

            result = defaultdict(lambda: defaultdict(list))
            for appointment in appointments:
                if appointment.physician_id and appointment.physician_id.id in physician_ids:
                    appointment_date = appointment.date
                    if isinstance(appointment_date, str):
                        if 'T' in appointment_date:
                            event_date = appointment_date.split('T')[0]
                        else:
                            event_date = appointment_date.split(' ')[0]
                    else:
                        event_date = appointment_date.strftime('%Y-%m-%d')

                    partner_names = [];
                    patient_name = ""
                    patient_phone = ""
                    patient_mobile = ""
                    patient_gender = None

                    if appointment.patient_id:
                        patient_name = appointment.patient_id.name
                        patient_gender = appointment.patient_id.gender
                        if appointment.patient_id.partner_id:
                            partner_names = [appointment.patient_id.partner_id.name]
                        patient_phone = appointment.patient_id.phone or ""
                        patient_mobile = appointment.patient_id.mobile or ""

                    local_start = appointment.date + timedelta(hours=3) if appointment.date else appointment.date
                    local_stop = appointment.date_to + timedelta(hours=3) if appointment.date_to else (
                        appointment.date + timedelta(hours=1) if appointment.date else None)

                    if appointment.date:
                        _logger.debug("Appointment %s - Week view - UTC start: %s, Local start: %s",
                                      appointment.id, appointment.date, local_start)

                    event_data = {
                        'id': appointment.id,
                        'name': appointment.name or 'Appointment',
                        'start': local_start.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_start,
                                                                                         datetime) else local_start,
                        'stop': local_stop.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_stop,
                                                                                       datetime) else local_stop,
                        'duration': appointment.duration,
                        'appointment_status': appointment.state,
                        'doctor_id': appointment.physician_id.id,
                        'doctor_name': appointment.physician_id.name,
                        'doctor_code': appointment.physician_id.code or '',
                        'doctor_specialty': appointment.department_id.name or 'No Department',
                        'partner_names': partner_names,
                        'patient_name': patient_name,
                        'patient_phone': patient_phone,
                        'patient_mobile': patient_mobile,
                        'patient_gender': patient_gender,
                        'cabin_name': appointment.cabin_id.name if appointment.cabin_id else '',
                        'color_index': self._get_appointment_color(appointment.state),
                        'is_all_day': False,
                        'consultation_type': appointment.consultation_type or 'consultation',
                        'treatment_schedule_id': appointment.treatment_schedule_id.id if appointment.treatment_schedule_id else None,
                        'treatment_schedule_line_id': appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else None,
                        'treatment_week': appointment.treatment_week or '',
                        'notes': appointment.notes or '',
                    }
                    result[appointment.physician_id.id][event_date].append(event_data)

            _logger.info("Week events prepared for %s physicians", len(result))
            return dict(result)

        except Exception as e:
            _logger.error("Error in get_week_events_by_assignee: %s", str(e))
            return {}

    @api.model
    def get_week_events_by_cabin(self, week_start, cabin_ids):
        """Get week appointments for calendar display grouped by cabin - normalizing timezone"""
        try:
            _logger.info("Getting week events by cabin - Input: week_start=%s, cabins=%s",
                         week_start, cabin_ids)

            if 'T' in week_start:
                week_start = week_start.split('T')[0]

            week_start_dt = datetime.strptime(week_start, '%Y-%m-%d')
            week_end = week_start_dt + timedelta(days=7)
            week_end_str = week_end.strftime('%Y-%m-d 23:59:59')
            week_start_str = week_start_dt.strftime('%Y-%m-%d 00:00:00')

            cabin_ids = [int(cid) for cid in cabin_ids]

            appointments = self.search([
                ('date', '>=', week_start_str),
                ('date', '<=', week_end_str),
                ('cabin_id', 'in', cabin_ids)
            ])

            _logger.info("Found %s appointments for cabins %s in week starting %s",
                         len(appointments), cabin_ids, week_start)

            result = defaultdict(lambda: defaultdict(list))
            for appointment in appointments:
                if appointment.cabin_id and appointment.cabin_id.id in cabin_ids:
                    appointment_date = appointment.date
                    if isinstance(appointment_date, str):
                        if 'T' in appointment_date:
                            event_date = appointment_date.split('T')[0]
                        else:
                            event_date = appointment_date.split(' ')[0]
                    else:
                        event_date = appointment_date.strftime('%Y-%m-%d')

                    partner_names = [];
                    patient_name = ""
                    patient_phone = ""
                    patient_mobile = ""
                    patient_gender = None

                    if appointment.patient_id:
                        patient_name = appointment.patient_id.name
                        patient_gender = appointment.patient_id.gender
                        if appointment.patient_id.partner_id:
                            partner_names = [appointment.patient_id.partner_id.name]
                        patient_phone = appointment.patient_id.phone or ""
                        patient_mobile = appointment.patient_id.mobile or ""

                    local_start = appointment.date + timedelta(hours=3) if appointment.date else appointment.date
                    local_stop = appointment.date_to + timedelta(hours=3) if appointment.date_to else (
                        appointment.date + timedelta(hours=1) if appointment.date else None)

                    if appointment.date:
                        _logger.debug("Appointment %s - Cabin week view - UTC start: %s, Local start: %s",
                                      appointment.id, appointment.date, local_start)

                    event_data = {
                        'id': appointment.id,
                        'name': appointment.name or 'Appointment',
                        'start': local_start.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_start,
                                                                                         datetime) else local_start,
                        'stop': local_stop.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_stop,
                                                                                       datetime) else local_stop,
                        'duration': appointment.duration,
                        'appointment_status': appointment.state,
                        'cabin_id': appointment.cabin_id.id,
                        'cabin_name': appointment.cabin_id.name,
                        'doctor_name': appointment.physician_id.name or '',
                        'doctor_specialty': appointment.department_id.name or 'No Department',
                        'partner_names': partner_names,
                        'patient_name': patient_name,
                        'patient_phone': patient_phone,
                        'patient_mobile': patient_mobile,
                        'patient_gender': patient_gender,
                        'color_index': self._get_appointment_color(appointment.state),
                        'is_all_day': False,
                        'consultation_type': appointment.consultation_type or 'consultation',
                        'treatment_schedule_id': appointment.treatment_schedule_id.id if appointment.treatment_schedule_id else None,
                        'treatment_schedule_line_id': appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else None,
                        'treatment_week': appointment.treatment_week or '',
                        'notes': appointment.notes or '',
                    }
                    result[appointment.cabin_id.id][event_date].append(event_data)

            _logger.info("Week cabin events prepared for %s cabins", len(result))
            return dict(result)

        except Exception as e:
            _logger.error("Error in get_week_events_by_cabin: %s", str(e))
            return {}

    @api.model
    def update_event_time(self, appointment_id, new_start, new_stop, new_physician_id=None, new_cabin_id=None):
        """Update appointment time, physician, and/or cabin - normalizing timezone"""
        try:
            appointment = self.browse(appointment_id)
            if not appointment.exists():
                _logger.error("Appointment %s does not exist", appointment_id)
                return False

            update_vals = {}

            _logger.info(
                "📝 LOG: Updating appointment %s - Original: start=%s, end=%s, physician=%s, cabin=%s, treatment_schedule_line=%s, treatment_week=%s, notes=%s",
                appointment_id, appointment.date, appointment.date_to,
                appointment.physician_id.name, appointment.cabin_id.name if appointment.cabin_id else 'None',
                appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else 'None',
                appointment.treatment_week or 'None',
                appointment.notes or 'None')

            if new_start:
                if len(new_start) == 16:
                    new_start += ':00'

                _logger.info("📝 LOG: New local start time: %s", new_start)
                new_start_dt = fields.Datetime.from_string(new_start)
                new_start_dt = new_start_dt - timedelta(hours=3)
                update_vals['date'] = fields.Datetime.to_string(new_start_dt)
                _logger.info("📝 LOG: Converted UTC start time: %s", update_vals['date'])

            if new_stop:
                if len(new_stop) == 16:
                    new_stop += ':00'

                _logger.info("📝 LOG: New local end time: %s", new_stop)
                new_stop_dt = fields.Datetime.from_string(new_stop)
                new_stop_dt = new_stop_dt - timedelta(hours=3)
                update_vals['date_to'] = fields.Datetime.to_string(new_stop_dt)
                _logger.info("📝 LOG: Converted UTC end time: %s", update_vals['date_to'])

            if new_physician_id and new_physician_id != appointment.physician_id.id:
                update_vals['physician_id'] = new_physician_id
                _logger.info("Changing physician to: %s", new_physician_id)

            if new_cabin_id and new_cabin_id != appointment.cabin_id.id:
                update_vals['cabin_id'] = new_cabin_id
                _logger.info("Changing cabin to: %s", new_cabin_id)

            if update_vals:
                appointment.write(update_vals)
                _logger.info(
                    "✅ LOG: Appointment %s updated successfully: date=%s, date_to=%s, physician=%s, cabin=%s, treatment_schedule_line=%s, treatment_week=%s, notes=%s",
                    appointment_id, appointment.date, appointment.date_to,
                    appointment.physician_id.name,
                    appointment.cabin_id.name if appointment.cabin_id else 'None',
                    appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else 'None',
                    appointment.treatment_week or 'None',
                    appointment.notes or 'None')
                return True
            else:
                _logger.warning("No changes to update for appointment %s", appointment_id)
                return True

        except Exception as e:
            _logger.error("Error updating appointment time for appointment %s: %s", appointment_id, str(e))
            raise ValidationError(f"Error updating appointment: {str(e)}")

    def _get_appointment_color(self, state):
        """Get color index based on appointment state"""
        color_map = {
            'draft': 1,
            'no_answer': 2,
            'call_back': 3,
            'posponed': 4,
            'confirm': 5,
            'booked': 6,
            'arrived': 7,
            'waiting': 8,
            'treatment': 9,
            'in_consultation': 10,
            'basic_7_floor': 11,
            'pause': 12,
            'to_invoice': 13,
            'gig_insurance': 14,
            'billed': 15,
            'done': 16,
            'cancelled': 17,
            'blocked': 18,
            'follow_up': 19,
            'feels_good': 20,
        }
        return color_map.get(state, 1)

    @api.model
    def get_calendar_events_by_cabin_and_physician(self, start_datetime, end_datetime, cabin_ids, physician_ids):
        """Get appointments for calendar display grouped by cabin and filtered by physician - normalizing timezone"""
        try:
            _logger.info(
                "Getting calendar events by cabin and physician - Input: start=%s, end=%s, cabins=%s, physicians=%s",
                start_datetime, end_datetime, cabin_ids, physician_ids)

            if isinstance(start_datetime, str):
                start_dt = fields.Datetime.from_string(start_datetime)
            else:
                start_dt = start_datetime

            if isinstance(end_datetime, str):
                end_dt = fields.Datetime.from_string(end_datetime)
            else:
                end_dt = end_datetime

            cabin_ids = [int(cid) for cid in cabin_ids]
            physician_ids = [int(pid) for pid in physician_ids]

            domain = [
                ('date', '>=', start_dt),
                ('date', '<=', end_dt),
                ('cabin_id', 'in', cabin_ids)
            ]

            if physician_ids:
                domain.append(('physician_id', 'in', physician_ids))

            appointments = self.search(domain)

            _logger.info("Found %s appointments for cabins %s and physicians %s in range %s to %s",
                         len(appointments), cabin_ids, physician_ids, start_datetime, end_datetime)

            result = defaultdict(list)
            for appointment in appointments:
                if appointment.cabin_id and appointment.cabin_id.id in cabin_ids:
                    partner_names = [];
                    patient_name = ""
                    patient_phone = ""
                    patient_mobile = ""
                    patient_gender = None

                    if appointment.patient_id:
                        patient_name = appointment.patient_id.name
                        patient_gender = appointment.patient_id.gender
                        if appointment.patient_id.partner_id:
                            partner_names = [appointment.patient_id.partner_id.name]
                        patient_phone = appointment.patient_id.phone or ""
                        patient_mobile = appointment.patient_id.mobile or ""

                    local_start = appointment.date + timedelta(hours=3) if appointment.date else appointment.date
                    local_stop = appointment.date_to + timedelta(hours=3) if appointment.date_to else (
                        appointment.date + timedelta(hours=1) if appointment.date else None)

                    if appointment.date:
                        _logger.debug("Appointment %s - Cabin/physician view - UTC start: %s, Local start: %s",
                                      appointment.id, appointment.date, local_start)

                    event_data = {
                        'id': appointment.id,
                        'name': appointment.name or 'Appointment',
                        'start': local_start.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_start,
                                                                                         datetime) else local_start,
                        'stop': local_stop.strftime('%Y-%m-%d %H:%M:%S') if isinstance(local_stop,
                                                                                       datetime) else local_stop,
                        'duration': appointment.duration,
                        'cabin_id': appointment.cabin_id.id,
                        'appointment_status': appointment.state,
                        'cabin_name': appointment.cabin_id.name,
                        'doctor_name': appointment.physician_id.name if appointment.physician_id else '',
                        'doctor_specialty': appointment.department_id.name if appointment.department_id else 'No Department',
                        'partner_names': partner_names,
                        'patient_name': patient_name,
                        'patient_code': appointment.patient_id.code if appointment.patient_id and appointment.patient_id.code else '',
                        'patient_phone': patient_phone,
                        'patient_mobile': patient_mobile,
                        'patient_gender': patient_gender,
                        'color_index': self._get_appointment_color(appointment.state),
                        'is_all_day': False,
                        'description': appointment.notes or '',
                        'consultation_type': appointment.consultation_type or 'consultation',
                        'treatment_schedule_id': appointment.treatment_schedule_id.id if appointment.treatment_schedule_id else None,
                        'treatment_schedule_line_id': appointment.treatment_schedule_line_id.id if appointment.treatment_schedule_line_id else None,
                        'treatment_week': appointment.treatment_week or '',
                        'notes': appointment.notes or '',
                    }
                    result[appointment.cabin_id.id].append(event_data)

            _logger.info("Returning events for %s cabins", len(result))
            return dict(result)

        except Exception as e:
            _logger.error("Error in get_calendar_events_by_cabin_and_physician: %s", str(e))
            return {}


class Physician(models.Model):
    _inherit = 'hms.physician'

    employee_id = fields.Many2one('hr.employee', string='Related Employee')

    @api.model
    def get_break_periods_for_range(self, physician_ids, start_date, end_date):
        """Get break and leave periods for physicians in date range"""
        try:
            result = {}

            if not isinstance(physician_ids, list):
                physician_ids = [physician_ids]

            physician_ids = [int(pid) for pid in physician_ids]

            physicians = self.browse(physician_ids)

            for physician in physicians:
                periods = []

                if physician.resource_calendar_id:
                    current_date = fields.Date.from_string(start_date)
                    end_date_obj = fields.Date.from_string(end_date)

                    while current_date <= end_date_obj:
                        day_of_week = current_date.weekday()
                        break_periods = physician.resource_calendar_id.attendance_ids.filtered(
                            lambda a: int(a.dayofweek) == day_of_week and a.is_break == True
                        )

                        for break_period in break_periods:
                            def float_to_time(float_hour):
                                hours = int(float_hour)
                                minutes = int((float_hour - hours) * 60)
                                return f"{hours:02d}:{minutes:02d}"

                            periods.append({
                                'date': current_date.strftime('%Y-%m-%d'),
                                'start_time': float_to_time(break_period.hour_from),
                                'end_time': float_to_time(break_period.hour_to),
                                'day_name': current_date.strftime('%A'),
                                'type': 'break'
                            })

                        current_date += timedelta(days=1)

                employee = physician.employee_id

                if not employee and physician.user_id:
                    employee = self.env['hr.employee'].search([
                        ('user_id', '=', physician.user_id.id)
                    ], limit=1)

                if employee:
                    leaves = self.env['hr.leave'].search([
                        ('employee_id', '=', employee.id),
                        ('state', '=', 'validate'),
                        ('date_from', '<=', end_date + ' 23:59:59'),
                        ('date_to', '>=', start_date + ' 00:00:00')
                    ])

                    for leave in leaves:
                        leave_start_date = fields.Date.from_string(leave.date_from)
                        leave_end_date = fields.Date.from_string(leave.date_to)

                        current_date = leave_start_date
                        while current_date <= leave_end_date:
                            date_str = current_date.strftime('%Y-%m-%d')

                            if current_date >= fields.Date.from_string(start_date) and \
                                    current_date <= fields.Date.from_string(end_date):

                                leave_start_time = '00:00'
                                leave_end_time = '23:59'

                                if leave.date_from and leave.date_to:
                                    start_dt = fields.Datetime.from_string(leave.date_from)
                                    end_dt = fields.Datetime.from_string(leave.date_to)

                                    if start_dt.date() == current_date and end_dt.date() == current_date:
                                        leave_start_time = start_dt.strftime('%H:%M')
                                        leave_end_time = end_dt.strftime('%H:%M')
                                    elif start_dt.date() == current_date:
                                        leave_start_time = start_dt.strftime('%H:%M')
                                    elif end_dt.date() == current_date:
                                        leave_end_time = end_dt.strftime('%H:%M')

                                periods.append({
                                    'date': date_str,
                                    'start_time': leave_start_time,
                                    'end_time': leave_end_time,
                                    'day_name': current_date.strftime('%A'),
                                    'type': 'leave',
                                    'leave_name': leave.holiday_status_id.name or 'Leave'
                                })

                            current_date += timedelta(days=1)

                result[physician.id] = periods

            _logger.info("Break and leave periods loaded for physicians %s: %s", physician_ids, result)
            return result
        except Exception as e:
            _logger.error("Error in get_break_periods_for_range: %s", str(e))
            return {}


class AppointmentCabin(models.Model):
    _inherit = 'appointment.cabin'

    @api.model
    def get_cabin_break_periods_for_range(self, cabin_ids, start_date, end_date):
        """Get break periods for cabins in date range"""
        try:
            result = {}

            if not isinstance(cabin_ids, list):
                cabin_ids = [cabin_ids]

            cabin_ids = [int(cid) for cid in cabin_ids]

            cabins = self.browse(cabin_ids)

            for cabin in cabins:
                periods = []

                if cabin.cabin_working_hour_ids:
                    current_date = fields.Date.from_string(start_date)
                    end_date_obj = fields.Date.from_string(end_date)

                    while current_date <= end_date_obj:
                        day_of_week = str(current_date.weekday())

                        break_periods = cabin.cabin_working_hour_ids.filtered(
                            lambda a: a.day_code == day_of_week and a.is_break == True
                        )

                        for breakPeriod in break_periods:
                            def float_to_time(float_hour):
                                hours = int(float_hour)
                                minutes = int((float_hour - hours) * 60)
                                return f"{hours:02d}:{minutes:02d}"

                            periods.append({
                                'date': current_date.strftime('%Y-%m-%d'),
                                'start_time': float_to_time(breakPeriod.time_from),
                                'end_time': float_to_time(breakPeriod.time_to),
                                'day_name': current_date.strftime('%A'),
                                'type': 'break'
                            })

                        current_date += timedelta(days=1)

                result[cabin.id] = periods

            _logger.info("Cabin break periods loaded: %s", result)
            return result
        except Exception as e:
            _logger.error("Error in get_cabin_break_periods_for_range: %s", str(e))
            return {}