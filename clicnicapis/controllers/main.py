# -*- coding: utf-8 -*-
import json
import logging
from odoo import http, _, fields
from odoo.http import request

_logger = logging.getLogger(__name__)

class ClicnicAPI(http.Controller):

    @http.route('/api/create_patient', type='json', auth='user', methods=['POST'], csrf=False)
    def create_patient(self, **kwargs):
        """
        Create a new patient in the HMS system.
        Expects a JSON payload with the following fields:
        - name (string, required)
        - email (string, optional)
        - mobile (string, optional)
        - gender (string, optional: male, female, other)
        - birthday (string, optional: YYYY-MM-DD)
        - gov_code (string, optional)
        - street (string, optional)
        - city (string, optional)
        """
        _logger.info("Received request to create patient with data: %s", kwargs)

        # Validate required fields
        if not kwargs.get('name'):
            return {
                'status': 'error',
                'message': _('The "name" field is required.')
            }

        try:
            # Prepare patient values
            # Note: hms.patient inherits from res.partner, so we can pass partner fields directly
            patient_vals = {
                'name': kwargs.get('name'),
                'email': kwargs.get('email'),
                'mobile': kwargs.get('mobile'),
                'gender': kwargs.get('gender', 'male'), # Default to male as per res.partner definition
                'birthday': kwargs.get('birthday'),
                'gov_code': kwargs.get('gov_code'),
                'street': kwargs.get('street'),
                'city': kwargs.get('city'),
            }

            # Create the patient record
            # We use sudo() if we want to bypass permission checks for the caller, 
            # but auth='user' already ensures a logged-in user.
            patient = request.env['hms.patient'].sudo().create(patient_vals)

            _logger.info("Patient created successfully with ID: %s", patient.id)

            return {
                'status': 'success',
                'data': {
                    'patient_id': patient.id,
                    'patient_name': patient.name,
                    'patient_code': patient.code,
                }
            }

        except Exception as e:
            _logger.error("Error creating patient: %s", str(e))
            return {
                'status': 'error',
                'message': str(e)
            }

    @http.route('/api/doctor_availability', type='json', auth='user', methods=['POST'], csrf=False)
    def check_doctor_availability(self, **kwargs):
        """
        Check doctor availability slots.
        Expects a JSON payload with:
        - physician_id (integer, optional)
        - department_id (integer, optional)
        """
        physician_id = kwargs.get('physician_id')
        department_id = kwargs.get('department_id')

        if not physician_id and not department_id:
            return {
                'status': 'error',
                'message': _('Either "physician_id" or "department_id" must be provided.')
            }

        try:
            schedule_data = {
                'schedule_type': 'appointment',
                'physician_id': physician_id,
                'department_id': department_id
            }
            
            # Fetch slots and disabled dates from the 'acs.schedule' model
            slot_data = request.env['acs.schedule'].sudo().acs_get_slot_data(**schedule_data)
            disable_dates = request.env['acs.schedule'].sudo().acs_get_disabled_dates(**schedule_data)

            return {
                'status': 'success',
                'data': {
                    'slot_data': slot_data,
                    'disable_dates': disable_dates
                }
            }

        except Exception as e:
            _logger.error("Error checking doctor availability: %s", str(e))
            return {
                'status': 'error',
                'message': str(e)
            }

    @http.route('/api/create_appointment', type='json', auth='user', methods=['POST'], csrf=False)
    def create_appointment(self, **kwargs):
        """
        Create a new appointment in the HMS system using a schedule slot.
        Expects a JSON payload with:
        - patient_id (integer, required)
        - schedule_slot_id (integer, required)
        - location (string, optional)
        """
        patient_id = kwargs.get('patient_id')
        schedule_slot_id = kwargs.get('schedule_slot_id')

        if not patient_id or not schedule_slot_id:
            return {
                'status': 'error',
                'message': _('Both "patient_id" and "schedule_slot_id" are required.')
            }

        try:
            env = request.env
            patient = env['hms.patient'].sudo().browse(int(patient_id))
            if not patient.exists():
                return {
                    'status': 'error',
                    'message': _('Patient not found.')
                }

            slot = env['acs.schedule.slot.lines'].sudo().browse(int(schedule_slot_id))
            if not slot.exists():
                return {
                    'status': 'error',
                    'message': _('Appointment slot not found.')
                }

            if slot.from_slot < fields.Datetime.now():
                return {
                    'status': 'error',
                    'message': _('The selected appointment slot is in the past.')
                }

            if slot.rem_limit <= 0:
                return {
                    'status': 'error',
                    'message': _('The selected appointment slot is already fully booked.')
                }

            # Calculate duration
            diff = slot.to_slot - slot.from_slot
            planned_duration = (diff.days * 24) + (diff.seconds / 3600.0)
            
            # Use patient's company or user's company
            company_id = patient.company_id.id if patient.company_id else env.user.company_id.id

            appointment_vals = {
                'patient_id': patient.id,
                'schedule_slot_id': slot.id,
                'date': slot.from_slot,
                'date_to': slot.to_slot,
                'schedule_date': slot.acs_slot_id.slot_date,
                'planned_duration': planned_duration,
                'company_id': company_id,
                'booked_online': True,
            }

            if slot.physician_id:
                appointment_vals['physician_id'] = slot.physician_id.id

            if kwargs.get('location'):
                appointment_vals['outside_appointment'] = True
                appointment_vals['location'] = kwargs.get('location')

            # Create Appointment
            appointment = env['hms.appointment'].sudo().create(appointment_vals)

            return {
                'status': 'success',
                'data': {
                    'appointment_id': appointment.id,
                    'appointment_name': appointment.name,
                    'patient_id': appointment.patient_id.id,
                    'date': appointment.date.strftime('%Y-%m-%d %H:%M:%S'),
                }
            }

        except Exception as e:
            _logger.error("Error creating appointment: %s", str(e))
            return {
                'status': 'error',
                'message': str(e)
            }
