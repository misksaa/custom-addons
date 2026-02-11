# -*- coding: utf-8 -*-
import logging
import json
from odoo import http
from odoo.http import request, Response

_logger = logging.getLogger(__name__)


class TreatmentScheduleController(http.Controller):

    @http.route('/treatment_schedule/get_schedule_data', type='json', auth='user', methods=['POST'], csrf=False)
    def get_schedule_data(self, **kwargs):
        """Get treatment schedule data for JavaScript view"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: get_schedule_data")
            _logger.info("Request kwargs: %s", kwargs)

            schedule_id = kwargs.get('schedule_id')

            _logger.info("schedule_id: %s", schedule_id)

            if not schedule_id:
                _logger.error("ERROR: No schedule_id provided in request")
                return {'error': 'No schedule ID provided'}

            data = request.env['hms.treatment.schedule'].get_schedule_data(schedule_id)
            _logger.info("SUCCESS: Data fetched for schedule_id=%s", schedule_id)
            _logger.info("Data keys: %s", list(data.keys()) if data else 'No data')
            _logger.info("=" * 50)

            return data
        except Exception as e:
            _logger.error("EXCEPTION in get_schedule_data: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'error': str(e)}

    @http.route('/treatment_schedule/update_schedule_field', type='json', auth='user', methods=['POST'], csrf=False)
    def update_schedule_field(self, **kwargs):
        """Update a single field on the treatment schedule"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: update_schedule_field")
            _logger.info("Request kwargs: %s", kwargs)

            schedule_id = kwargs.get('schedule_id')
            field_name = kwargs.get('field_name')
            value = kwargs.get('value')

            _logger.info("schedule_id: %s, field_name: %s, value: %s", schedule_id, field_name, value)

            if not schedule_id or not field_name:
                _logger.error("ERROR: Missing parameters")
                return {'success': False, 'error': 'Missing parameters'}

            result = request.env['hms.treatment.schedule'].update_schedule_field(
                schedule_id, field_name, value
            )
            _logger.info("SUCCESS: update_schedule_field result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in update_schedule_field: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/get_line_data', type='json', auth='user', methods=['POST'], csrf=False)
    def get_line_data(self, **kwargs):
        """Get treatment schedule line data"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: get_line_data")
            _logger.info("Request kwargs: %s", kwargs)

            line_id = kwargs.get('line_id')
            _logger.info("line_id: %s", line_id)

            if not line_id:
                _logger.error("ERROR: No line_id provided")
                return {'error': 'No line ID provided'}

            data = request.env['hms.treatment.schedule.line'].get_line_data(line_id)
            _logger.info("SUCCESS: get_line_data for line_id=%s", line_id)
            _logger.info("=" * 50)
            return data
        except Exception as e:
            _logger.error("EXCEPTION in get_line_data: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'error': str(e)}

    @http.route('/treatment_schedule/create_line', type='json', auth='user', methods=['POST'], csrf=False)
    def create_line(self, **kwargs):
        """Create a new treatment schedule line"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: create_line")
            _logger.info("Request kwargs: %s", kwargs)

            schedule_id = kwargs.get('schedule_id')
            product_id = kwargs.get('product_id')
            sequence = kwargs.get('sequence', 10)

            _logger.info("schedule_id: %s, product_id: %s, sequence: %s", schedule_id, product_id, sequence)

            if not schedule_id or not product_id:
                _logger.error("ERROR: Missing parameters")
                return {'error': 'Missing parameters'}

            result = request.env['hms.treatment.schedule.line'].create_line(
                schedule_id, product_id, sequence
            )
            _logger.info("SUCCESS: create_line result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in create_line: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'error': str(e)}

    @http.route('/treatment_schedule/update_line_week', type='json', auth='user', methods=['POST'], csrf=False)
    def update_line_week(self, **kwargs):
        """Update a specific week's date and number on a line"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: update_line_week")
            _logger.info("Request kwargs: %s", kwargs)

            line_id = kwargs.get('line_id')
            week_number = kwargs.get('week_number')
            date_value = kwargs.get('date_value')
            number_value = kwargs.get('number_value')

            _logger.info("line_id: %s, week_number: %s, date_value: %s, number_value: %s",
                         line_id, week_number, date_value, number_value)

            if not line_id or not week_number:
                _logger.error("ERROR: Missing parameters")
                return {'success': False, 'error': 'Missing parameters'}

            result = request.env['hms.treatment.schedule.line'].update_line_week(
                line_id, week_number, date_value, number_value
            )
            _logger.info("SUCCESS: update_line_week result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in update_line_week: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/delete_line', type='json', auth='user', methods=['POST'], csrf=False)
    def delete_line(self, **kwargs):
        """Delete a treatment schedule line"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: delete_line")
            _logger.info("Request kwargs: %s", kwargs)

            line_id = kwargs.get('line_id')
            _logger.info("line_id: %s", line_id)

            if not line_id:
                _logger.error("ERROR: No line_id provided")
                return {'success': False, 'error': 'No line ID provided'}

            result = request.env['hms.treatment.schedule.line'].delete_line(line_id)
            _logger.info("SUCCESS: delete_line result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in delete_line: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/update_line_product', type='json', auth='user', methods=['POST'], csrf=False)
    def update_line_product(self, **kwargs):
        """Update the product (session type) of a line"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: update_line_product")
            _logger.info("Request kwargs: %s", kwargs)

            line_id = kwargs.get('line_id')
            product_id = kwargs.get('product_id')

            _logger.info("line_id: %s, product_id: %s", line_id, product_id)

            if not line_id or not product_id:
                _logger.error("ERROR: Missing parameters")
                return {'success': False, 'error': 'Missing parameters'}

            result = request.env['hms.treatment.schedule.line'].update_line_product(
                line_id, product_id
            )
            _logger.info("SUCCESS: update_line_product result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in update_line_product: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/add_appointment_to_week', type='json', auth='user', methods=['POST'], csrf=False)
    def add_appointment_to_week(self, **kwargs):
        """Add appointment to a specific week"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: add_appointment_to_week")
            _logger.info("Request kwargs: %s", kwargs)

            line_id = kwargs.get('line_id')
            week_number = kwargs.get('week_number')
            appointment_id = kwargs.get('appointment_id')

            _logger.info("line_id: %s, week_number: %s, appointment_id: %s",
                         line_id, week_number, appointment_id)

            if not line_id or not week_number or not appointment_id:
                _logger.error("ERROR: Missing parameters")
                return {'success': False, 'error': 'Missing parameters'}

            result = request.env['hms.treatment.schedule.line'].add_appointment_to_week(
                line_id, week_number, appointment_id
            )
            _logger.info("SUCCESS: add_appointment_to_week result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in add_appointment_to_week: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/remove_appointment_from_week', type='json', auth='user', methods=['POST'], csrf=False)
    def remove_appointment_from_week(self, **kwargs):
        """Remove appointment from a specific week"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: remove_appointment_from_week")
            _logger.info("Request kwargs: %s", kwargs)

            line_id = kwargs.get('line_id')
            week_number = kwargs.get('week_number')
            appointment_id = kwargs.get('appointment_id')

            _logger.info("line_id: %s, week_number: %s, appointment_id: %s",
                         line_id, week_number, appointment_id)

            if not line_id or not week_number or not appointment_id:
                _logger.error("ERROR: Missing parameters")
                return {'success': False, 'error': 'Missing parameters'}

            result = request.env['hms.treatment.schedule.line'].remove_appointment_from_week(
                line_id, week_number, appointment_id
            )
            _logger.info("SUCCESS: remove_appointment_from_week result: %s", result)
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in remove_appointment_from_week: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/get_available_products', type='json', auth='user', methods=['POST'], csrf=False)
    def get_available_products(self, **kwargs):
        """Get available products for session types"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: get_available_products")

            products = request.env['hms.treatment.schedule'].get_available_products()
            _logger.info("SUCCESS: Returned %d products", len(products))
            _logger.info("=" * 50)
            return products
        except Exception as e:
            _logger.error("EXCEPTION in get_available_products: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return []

    @http.route('/treatment_schedule/get_available_physicians', type='json', auth='user', methods=['POST'], csrf=False)
    def get_available_physicians(self, **kwargs):
        """Get available physicians"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: get_available_physicians")

            physicians = request.env['hms.treatment.schedule'].get_available_physicians()
            _logger.info("SUCCESS: Returned %d physicians", len(physicians))
            _logger.info("=" * 50)
            return physicians
        except Exception as e:
            _logger.error("EXCEPTION in get_available_physicians: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return []

    @http.route('/treatment_schedule/get_available_appointments', type='json', auth='user', methods=['POST'],
                csrf=False)
    def get_available_appointments(self, **kwargs):
        """Get available appointments for linking"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: get_available_appointments")

            patient_id = kwargs.get('patient_id')
            _logger.info("Patient ID: %s", patient_id)

            # Get appointments that are not linked to any treatment schedule line
            domain = [('state', 'not in', ['canceled', 'done'])]
            if patient_id:
                domain.append(('patient_id', '=', int(patient_id)))

            appointments = request.env['hms.appointment'].search(domain, limit=100)

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

            _logger.info("SUCCESS: Returned %d available appointments", len(result))
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in get_available_appointments: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return []

    @http.route('/treatment_schedule/update_state', type='json', auth='user', methods=['POST'], csrf=False)
    def update_state(self, **kwargs):
        """Update the state of a treatment schedule"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: update_state")
            _logger.info("Request kwargs: %s", kwargs)

            schedule_id = kwargs.get('schedule_id')
            new_state = kwargs.get('new_state')

            _logger.info("schedule_id: %s, new_state: %s", schedule_id, new_state)

            if not schedule_id or not new_state:
                _logger.error("ERROR: Missing parameters")
                return {'success': False, 'error': 'Missing parameters'}

            schedule = request.env['hms.treatment.schedule'].browse(int(schedule_id))
            if not schedule.exists():
                _logger.error("ERROR: Schedule not found: %s", schedule_id)
                return {'success': False, 'error': 'Schedule not found'}

            schedule.write({'state': new_state})
            _logger.info("SUCCESS: State updated to %s for schedule_id=%s", new_state, schedule_id)
            _logger.info("=" * 50)
            return {'success': True, 'state': new_state}
        except Exception as e:
            _logger.error("EXCEPTION in update_state: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/print_report', type='json', auth='user', methods=['POST'], csrf=False)
    def print_report(self, **kwargs):
        """Get report URL for printing"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: print_report")
            _logger.info("Request kwargs: %s", kwargs)

            schedule_id = kwargs.get('schedule_id')
            _logger.info("schedule_id: %s", schedule_id)

            if not schedule_id:
                _logger.error("ERROR: No schedule_id provided")
                return {'success': False, 'error': 'No schedule ID provided'}

            schedule = request.env['hms.treatment.schedule'].browse(int(schedule_id))
            if not schedule.exists():
                _logger.error("ERROR: Schedule not found: %s", schedule_id)
                return {'success': False, 'error': 'Schedule not found'}

            report_url = f'/report/pdf/hms_treatment_schedule.report_treatment_schedule/{schedule_id}'
            _logger.info("SUCCESS: Report URL generated: %s", report_url)
            _logger.info("=" * 50)
            return {'success': True, 'url': report_url}
        except Exception as e:
            _logger.error("EXCEPTION in print_report: %s", str(e), exc_info=True)
            _logger.error("=" * 50)
            return {'success': False, 'error': str(e)}

    @http.route('/treatment_schedule/get_session_types', type='json', auth='user', methods=['POST'], csrf=False)
    def get_session_types(self, **kwargs):
        """Get available session types (products)"""
        try:
            _logger.info("=" * 50)
            _logger.info("API CALL: get_session_types")

            search_term = kwargs.get('search_term', '')
            _logger.info("Search term: %s", search_term)

            result = request.env['hms.treatment.schedule'].get_available_products()
            # Filter by search term
            if search_term:
                search_term_lower = search_term.lower()
                result = [p for p in result if search_term_lower in p['name'].lower()]
            _logger.info("SUCCESS: Returned %d products", len(result))
            _logger.info("=" * 50)
            return result
        except Exception as e:
            _logger.error("EXCEPTION in get_session_types: %s", str(e))
            _logger.error("=" * 50)
            return {'error': str(e)}