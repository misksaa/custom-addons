# -*- coding: utf-8 -*-
import json
import logging
from odoo import http, _
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
