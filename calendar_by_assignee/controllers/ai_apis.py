# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
import json
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class AiApis(http.Controller):

    # ==================== PATIENT MANAGEMENT ====================

    @http.route('/ai/search_patients', type='json', auth='user', methods=['POST'])
    def search_patients(self, search_term, limit=20):
        """
        Search for patients by name, phone or code.
        Inputs:
            search_term (str): text to search (required, at least 2 characters)
            limit (int, optional): maximum number of results (default 20)
        Outputs:
            list of dict: matching patients with fields: id, name, phone, mobile, code, gender, age
        """
        try:
            if not search_term or len(search_term.strip()) < 2:
                return {'error': 'Search term must be at least 2 characters'}

            domain = ['|', '|', ('name', 'ilike', search_term),
                      ('phone', 'ilike', search_term),
                      ('mobile', 'ilike', search_term)]
            patients = request.env['hms.patient'].search_read(
                domain,
                ['id', 'name', 'phone', 'mobile', 'code', 'gender', 'age'],
                limit=limit
            )
            return patients
        except Exception as e:
            _logger.error(f"Error in search_patients: {e}")
            return {'error': str(e)}

    @http.route('/ai/create_patient', type='json', auth='user', methods=['POST'])
    def create_patient(self, name, phone=None, mobile=None, email=None, gender=None, birthdate=None):
        """
        Create a new patient.
        Inputs:
            name (str): patient name (required)
            phone (str, optional): landline phone
            mobile (str, optional): mobile phone
            email (str, optional): email address
            gender (str, optional): gender ('male', 'female', 'other')
            birthdate (str, optional): birth date (YYYY-MM-DD)
        Outputs:
            dict: created patient data (id, name, ...) or error message
        """
        try:
            if not name:
                return {'error': 'Patient name is required'}

            vals = {'name': name}
            if phone:
                vals['phone'] = phone
            if mobile:
                vals['mobile'] = mobile
            if email:
                vals['email'] = email
            if gender:
                vals['gender'] = gender
            if birthdate:
                vals['birthdate'] = birthdate

            patient = request.env['hms.patient'].create(vals)
            return {
                'id': patient.id,
                'name': patient.name,
                'phone': patient.phone,
                'mobile': patient.mobile,
                'code': patient.code,
                'message': 'Patient created successfully'
            }
        except Exception as e:
            _logger.error(f"Error in create_patient: {e}")
            return {'error': str(e)}

    @http.route('/ai/get_patient', type='json', auth='user', methods=['POST'])
    def get_patient(self, patient_id):
        """
        Fetch details of a specific patient.
        Inputs:
            patient_id (int): patient ID
        Outputs:
            dict: patient data with basic fields
        """
        try:
            patient = request.env['hms.patient'].browse(int(patient_id))
            if not patient.exists():
                return {'error': 'Patient not found'}
            return {
                'id': patient.id,
                'name': patient.name,
                'phone': patient.phone,
                'mobile': patient.mobile,
                'code': patient.code,
                'gender': patient.gender,
                'age': patient.age,
                'email': patient.email,
                'medical_alert': patient.medical_alert,
                'is_blacklist': patient.is_blacklist,
            }
        except Exception as e:
            return {'error': str(e)}

    # ==================== PHYSICIAN MANAGEMENT ====================

    @http.route('/ai/search_physicians', type='json', auth='user', methods=['POST'])
    def search_physicians(self, search_term=None, department_id=None, limit=20):
        """
        Search for physicians.
        Inputs:
            search_term (str, optional): search in name or code
            department_id (int, optional): department ID filter
            limit (int): maximum number of results
        Outputs:
            list of dict: physicians with fields: id, name, code, department
        """
        try:
            domain = [('active', '=', True)]
            if search_term:
                domain += ['|', ('name', 'ilike', search_term), ('code', 'ilike', search_term)]
            if department_id:
                domain.append(('department_id', '=', int(department_id)))

            physicians = request.env['hms.physician'].search_read(
                domain,
                ['id', 'name', 'code', 'department_id'],
                limit=limit
            )
            # add department name for each physician
            for phy in physicians:
                if phy.get('department_id') and phy['department_id'][0]:
                    dept = request.env['hms.department'].browse(phy['department_id'][0])
                    phy['department_name'] = dept.name
            return physicians
        except Exception as e:
            return {'error': str(e)}

    # ==================== CABIN MANAGEMENT ====================

    @http.route('/ai/search_cabins', type='json', auth='user', methods=['POST'])
    def search_cabins(self, search_term=None, limit=20):
        """
        Search for consultation rooms (cabins).
        Inputs:
            search_term (str, optional): search in name
            limit (int): maximum number of results
        Outputs:
            list of dict: cabins with fields: id, name
        """
        try:
            domain = []
            if search_term:
                domain.append(('name', 'ilike', search_term))
            cabins = request.env['appointment.cabin'].search_read(
                domain,
                ['id', 'name'],
                limit=limit
            )
            return cabins
        except Exception as e:
            return {'error': str(e)}

    # ==================== PRODUCT / SERVICE MANAGEMENT ====================

    @http.route('/ai/get_consultation_services', type='json', auth='user', methods=['POST'])
    def get_consultation_services(self):
        """
        Fetch list of available consultation services (products).
        Outputs:
            list of dict: services with fields: id, name, list_price
        """
        try:
            services = request.env['product.product'].search_read(
                [('hospital_product_type', '=', 'consultation')],
                ['id', 'name', 'list_price']
            )
            return services
        except Exception as e:
            return {'error': str(e)}

    # ==================== APPOINTMENT MANAGEMENT ====================

    @http.route('/ai/get_physician_appointments', type='json', auth='user', methods=['POST'])
    def get_physician_appointments(self, physician_id, start_date, end_date):
        """
        Fetch appointments for a specific physician within a date range.
        Inputs:
            physician_id (int): physician ID
            start_date (str): start datetime (YYYY-MM-DD HH:MM:SS)
            end_date (str): end datetime (YYYY-MM-DD HH:MM:SS)
        Outputs:
            list of dict: list of appointments
        """
        try:
            appointments = request.env['hms.appointment'].search_read(
                [
                    ('physician_id', '=', int(physician_id)),
                    ('date', '>=', start_date),
                    ('date', '<=', end_date)
                ],
                ['id', 'name', 'date', 'date_to', 'patient_id', 'state', 'cabin_id']
            )
            # convert patient_id and cabin_id to names
            for app in appointments:
                if app.get('patient_id') and app['patient_id'][0]:
                    patient = request.env['hms.patient'].browse(app['patient_id'][0])
                    app['patient_name'] = patient.name
                if app.get('cabin_id') and app['cabin_id'][0]:
                    cabin = request.env['appointment.cabin'].browse(app['cabin_id'][0])
                    app['cabin_name'] = cabin.name
            return appointments
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/get_patient_appointments', type='json', auth='user', methods=['POST'])
    def get_patient_appointments(self, patient_id, limit=50):
        """
        Fetch appointments for a specific patient (most recent).
        Inputs:
            patient_id (int): patient ID
            limit (int): maximum number of appointments
        Outputs:
            list of dict: list of appointments
        """
        try:
            appointments = request.env['hms.appointment'].search_read(
                [('patient_id', '=', int(patient_id))],
                ['id', 'name', 'date', 'date_to', 'physician_id', 'state', 'cabin_id'],
                order='date desc',
                limit=limit
            )
            for app in appointments:
                if app.get('physician_id') and app['physician_id'][0]:
                    phy = request.env['hms.physician'].browse(app['physician_id'][0])
                    app['physician_name'] = phy.name
                if app.get('cabin_id') and app['cabin_id'][0]:
                    cabin = request.env['appointment.cabin'].browse(app['cabin_id'][0])
                    app['cabin_name'] = cabin.name
            return appointments
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/check_appointment_availability', type='json', auth='user', methods=['POST'])
    def check_appointment_availability(self, physician_id, cabin_id, start_datetime, end_datetime, patient_gender=None, exclude_appointment_id=None):
        """
        Check availability of a physician and cabin for a given time slot.
        Inputs:
            physician_id (int): physician ID (can be 0 if not relevant)
            cabin_id (int): cabin ID (can be 0 if not relevant)
            start_datetime (str): start datetime
            end_datetime (str): end datetime
            patient_gender (str, optional): patient gender (for gender conflict check)
            exclude_appointment_id (int, optional): appointment ID to exclude from check (e.g., when updating)
        Outputs:
            dict: {
                'available': bool,
                'conflicts': list of reasons,
                'physician_available': bool,
                'cabin_available': bool,
                'gender_conflict': bool,
                'message': str
            }
        """
        try:
            result = {
                'available': True,
                'conflicts': [],
                'physician_available': True,
                'cabin_available': True,
                'gender_conflict': False,
                'message': 'Available'
            }

            # Check physician
            if physician_id and physician_id > 0:
                physician_overlap = request.env['hms.appointment'].search_count([
                    ('physician_id', '=', physician_id),
                    ('date', '<', end_datetime),
                    ('date_to', '>', start_datetime),
                    ('state', 'not in', ['cancelled', 'done']),
                    ('id', '!=', exclude_appointment_id or 0)
                ])
                if physician_overlap:
                    result['available'] = False
                    result['physician_available'] = False
                    result['conflicts'].append('Physician has another appointment at this time')

            # Check cabin
            if cabin_id and cabin_id > 0:
                # Use existing cabin conflict method
                cabin_conflict = request.env['hms.appointment'].check_cabin_appointment_conflict(
                    cabin_id, start_datetime, end_datetime,
                    patient_gender or False,
                    exclude_appointment_id or False
                )
                if cabin_conflict.get('hasConflict'):
                    result['available'] = False
                    result['cabin_available'] = False
                    if cabin_conflict.get('genderConflict'):
                        result['gender_conflict'] = True
                        result['conflicts'].append('Gender conflict in the cabin')
                    else:
                        result['conflicts'].append('Cabin is already booked at this time')

            if result['available']:
                result['message'] = 'Available'
            else:
                result['message'] = '; '.join(result['conflicts'])

            return result
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/create_appointment', type='json', auth='user', methods=['POST'])
    def create_appointment(self, patient_id, physician_id, product_id, cabin_id,
                           start_datetime, end_datetime, consultation_type='consultation',
                           state='draft', notes=''):
        """
        Create a new appointment with availability check.
        Inputs:
            patient_id (int): patient ID
            physician_id (int): physician ID
            product_id (int): service ID
            cabin_id (int): cabin ID
            start_datetime (str): start datetime (YYYY-MM-DD HH:MM:SS)
            end_datetime (str): end datetime
            consultation_type (str): consultation type (consultation, followup, treatment_schedule)
            state (str): appointment state (draft, confirm, ...)
            notes (str): notes
        Outputs:
            dict: created appointment data or error message
        """
        try:
            # Validate existence
            patient = request.env['hms.patient'].browse(int(patient_id))
            if not patient.exists():
                return {'error': 'Patient not found'}
            physician = request.env['hms.physician'].browse(int(physician_id))
            if not physician.exists():
                return {'error': 'Physician not found'}
            cabin = request.env['appointment.cabin'].browse(int(cabin_id))
            if not cabin.exists():
                return {'error': 'Cabin not found'}
            product = request.env['product.product'].browse(int(product_id))
            if not product.exists():
                return {'error': 'Service not found'}

            # Check availability
            availability = self.check_appointment_availability(
                physician_id, cabin_id, start_datetime, end_datetime,
                patient.gender, None
            )
            if not availability.get('available'):
                return {'error': availability.get('message', 'Time slot not available')}

            # Create appointment
            appointment_vals = {
                'patient_id': patient_id,
                'physician_id': physician_id,
                'product_id': product_id,
                'cabin_id': cabin_id,
                'date': start_datetime,
                'date_to': end_datetime,
                'consultation_type': consultation_type,
                'state': state,
                'notes': notes,
            }
            appointment = request.env['hms.appointment'].create(appointment_vals)
            return {
                'id': appointment.id,
                'name': appointment.name,
                'start': appointment.date,
                'end': appointment.date_to,
                'message': 'Appointment created successfully'
            }
        except Exception as e:
            _logger.error(f"Error in create_appointment: {e}")
            return {'error': str(e)}

    @http.route('/ai/update_appointment', type='json', auth='user', methods=['POST'])
    def update_appointment(self, appointment_id, **kwargs):
        """
        Update an existing appointment.
        Inputs:
            appointment_id (int): appointment ID
            Any of the editable fields: physician_id, cabin_id, start_datetime, end_datetime, state, notes, product_id
        Outputs:
            dict: update result
        """
        try:
            appointment = request.env['hms.appointment'].browse(int(appointment_id))
            if not appointment.exists():
                return {'error': 'Appointment not found'}

            # Build values dict
            vals = {}
            if 'physician_id' in kwargs:
                vals['physician_id'] = int(kwargs['physician_id'])
            if 'cabin_id' in kwargs:
                vals['cabin_id'] = int(kwargs['cabin_id'])
            if 'start_datetime' in kwargs:
                vals['date'] = kwargs['start_datetime']
            if 'end_datetime' in kwargs:
                vals['date_to'] = kwargs['end_datetime']
            if 'state' in kwargs:
                vals['state'] = kwargs['state']
            if 'notes' in kwargs:
                vals['notes'] = kwargs['notes']
            if 'product_id' in kwargs:
                vals['product_id'] = int(kwargs['product_id'])

            # If time, physician or cabin changed, check availability
            if any(f in vals for f in ['date', 'date_to', 'physician_id', 'cabin_id']):
                physician_id = vals.get('physician_id', appointment.physician_id.id)
                cabin_id = vals.get('cabin_id', appointment.cabin_id.id)
                start = vals.get('date', appointment.date)
                end = vals.get('date_to', appointment.date_to)
                patient_gender = appointment.patient_id.gender if appointment.patient_id else None

                availability = self.check_appointment_availability(
                    physician_id, cabin_id, start, end,
                    patient_gender, appointment.id
                )
                if not availability.get('available'):
                    return {'error': availability.get('message', 'Time slot not available')}

            appointment.write(vals)
            return {'success': True, 'message': 'Appointment updated successfully'}
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/cancel_appointment', type='json', auth='user', methods=['POST'])
    def cancel_appointment(self, appointment_id):
        """
        Cancel an appointment (set state to cancelled).
        Inputs:
            appointment_id (int): appointment ID
        Outputs:
            dict: cancellation result
        """
        try:
            appointment = request.env['hms.appointment'].browse(int(appointment_id))
            if not appointment.exists():
                return {'error': 'Appointment not found'}
            appointment.write({'state': 'cancelled'})
            return {'success': True, 'message': 'Appointment cancelled'}
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/get_appointment', type='json', auth='user', methods=['POST'])
    def get_appointment(self, appointment_id):
        """
        Fetch details of a specific appointment.
        Inputs:
            appointment_id (int): appointment ID
        Outputs:
            dict: appointment data with related fields
        """
        try:
            appointment = request.env['hms.appointment'].browse(int(appointment_id))
            if not appointment.exists():
                return {'error': 'Appointment not found'}
            data = {
                'id': appointment.id,
                'name': appointment.name,
                'start': appointment.date,
                'end': appointment.date_to,
                'state': appointment.state,
                'consultation_type': appointment.consultation_type,
                'notes': appointment.notes,
                'patient': {'id': appointment.patient_id.id, 'name': appointment.patient_id.name} if appointment.patient_id else None,
                'physician': {'id': appointment.physician_id.id, 'name': appointment.physician_id.name} if appointment.physician_id else None,
                'cabin': {'id': appointment.cabin_id.id, 'name': appointment.cabin_id.name} if appointment.cabin_id else None,
                'product': {'id': appointment.product_id.id, 'name': appointment.product_id.name} if appointment.product_id else None,
            }
            return data
        except Exception as e:
            return {'error': str(e)}

    # ==================== BREAK / LEAVE PERIODS ====================

    @http.route('/ai/get_physician_breaks', type='json', auth='user', methods=['POST'])
    def get_physician_breaks(self, physician_id, start_date, end_date):
        """
        Fetch break and leave periods for a specific physician within a date range.
        Inputs:
            physician_id (int): physician ID
            start_date (str): start date (YYYY-MM-DD)
            end_date (str): end date (YYYY-MM-DD)
        Outputs:
            list: list of periods
        """
        try:
            breaks = request.env['hms.physician'].get_break_periods_for_range(
                [physician_id], start_date, end_date
            )
            return breaks.get(str(physician_id), [])
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/get_cabin_breaks', type='json', auth='user', methods=['POST'])
    def get_cabin_breaks(self, cabin_id, start_date, end_date):
        """
        Fetch break periods for a specific cabin.
        Inputs:
            cabin_id (int): cabin ID
            start_date (str): start date (YYYY-MM-DD)
            end_date (str): end date (YYYY-MM-DD)
        Outputs:
            list: list of periods
        """
        try:
            breaks = request.env['appointment.cabin'].get_cabin_break_periods_for_range(
                [cabin_id], start_date, end_date
            )
            return breaks.get(str(cabin_id), [])
        except Exception as e:
            return {'error': str(e)}

    # ==================== TREATMENT SCHEDULE (if available) ====================

    @http.route('/ai/get_treatment_schedules', type='json', auth='user', methods=['POST'])
    def get_treatment_schedules(self, patient_id):
        """
        Fetch treatment schedules for a specific patient (if module exists).
        Inputs:
            patient_id (int): patient ID
        Outputs:
            list: list of treatment schedules
        """
        try:
            if not hasattr(request.env, 'hms.treatment.schedule'):
                return {'error': 'Treatment schedule model not found'}
            schedules = request.env['hms.treatment.schedule'].search_read(
                [('patient_id', '=', int(patient_id))],
                ['id', 'name', 'date', 'state', 'total_weeks']
            )
            return schedules
        except Exception as e:
            return {'error': str(e)}

    @http.route('/ai/get_treatment_schedule_data', type='json', auth='user', methods=['POST'])
    def get_treatment_schedule_data(self, schedule_id):
        """
        Fetch detailed data of a specific treatment schedule (including cards).
        This calls the existing /treatment_schedule/get_schedule_data endpoint if available.
        Inputs:
            schedule_id (int): schedule ID
        Outputs:
            dict: schedule data with session types and cards
        """
        try:
            # This relies on the existence of the route; we forward the call
            response = request.env['ir.http']._serve_route('/treatment_schedule/get_schedule_data', {
                'schedule_id': schedule_id
            })
            return response
        except Exception as e:
            return {'error': str(e)}