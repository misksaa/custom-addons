from odoo import http
from odoo.http import request
import json
from datetime import datetime, timedelta


class CalendarByAssigneeController(http.Controller):

    @http.route('/calendar_by_assignee/get_day_events', type='json', auth='user')
    def get_day_events(self, start_date, end_date, physician_ids):
        events = request.env['hms.appointment'].get_calendar_events_by_assignee(
            start_date, end_date, physician_ids
        )
        return events

    @http.route('/calendar_by_assignee/get_cabin_day_events', type='json', auth='user')
    def get_cabin_day_events(self, start_date, end_date, cabin_ids):
        events = request.env['hms.appointment'].get_calendar_events_by_cabin(
            start_date, end_date, cabin_ids
        )
        return events

    @http.route('/calendar_by_assignee/get_week_events', type='json', auth='user')
    def get_week_events(self, week_start, physician_ids):
        events = request.env['hms.appointment'].get_week_events_by_assignee(
            week_start, physician_ids
        )
        return events

    @http.route('/calendar_by_assignee/create_event', type='json', auth='user')
    def create_event(self, event_data):
        appointment = request.env['hms.appointment'].create(event_data)
        return {
            'id': appointment.id,
            'name': appointment.name,
            'start': appointment.date,
            'stop': appointment.date_to
        }

    @http.route('/calendar_by_assignee/update_event_time', type='json', auth='user')
    def update_event_time(self, appointment_id, new_start, new_stop, new_physician_id=None, new_cabin_id=None):
        result = request.env['hms.appointment'].update_event_time(
            appointment_id, new_start, new_stop, new_physician_id, new_cabin_id
        )
        return result

    @http.route('/calendar_by_assignee/get_cabin_day_events_with_physician', type='json', auth='user')
    def get_cabin_day_events_with_physician(self, start_date, end_date, cabin_ids, physician_ids):
        events = request.env['hms.appointment'].get_calendar_events_by_cabin_and_physician(
            start_date, end_date, cabin_ids, physician_ids
        )
        return events

    # NEW: Route for getting break periods
    @http.route('/calendar_by_assignee/get_break_periods', type='json', auth='user')
    def get_break_periods(self, physician_ids, start_date, end_date):
        try:
            break_periods = request.env['hms.physician'].get_break_periods_for_range(
                physician_ids, start_date, end_date
            )
            return break_periods
        except Exception as e:
            _logger.error("Error in get_break_periods route: %s", str(e))
            return {}

    @http.route('/calendar_by_assignee/get_cabin_break_periods', type='json', auth='user')
    def get_cabin_break_periods(self, cabin_ids, start_date, end_date):
        try:
            break_periods = request.env['appointment.cabin'].get_cabin_break_periods_for_range(
                cabin_ids, start_date, end_date
            )
            return break_periods
        except Exception as e:
            _logger.error("Error in get_cabin_break_periods route: %s", str(e))
            return {}