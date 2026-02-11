# -*- coding: utf-8 -*-

import datetime
from datetime import time, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError
import pytz
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT,DEFAULT_SERVER_DATE_FORMAT
import math
from pytz import timezone, utc
from odoo.tools.float_utils import float_round
from odoo.addons.base.models.res_partner import _tz_get

import logging
_logger = logging.getLogger(__name__)


def float_to_time(hours):
    """ Convert a number of hours into a time object. """
    if hours == 24.0:
        return time.max
    fractional, integral = math.modf(hours)
    int_fractional = int(float_round(60 * fractional, precision_digits=0))
    if int_fractional > 59:
        integral += 1
        int_fractional = 0
    return time(int(integral), int_fractional, 0)


class ACSSchedule(models.Model):
    _name = "acs.schedule"
    _description = "Booking schedule"

    def acs_get_default_schedule_lines(self):
        return [
            (0, 0, {'name': _('Monday Morning'), 'dayofweek': '0', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
            (0, 0, {'name': _('Monday Evening'), 'dayofweek': '0', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
            (0, 0, {'name': _('Tuesday Morning'), 'dayofweek': '1', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
            (0, 0, {'name': _('Tuesday Evening'), 'dayofweek': '1', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
            (0, 0, {'name': _('Wednesday Morning'), 'dayofweek': '2', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
            (0, 0, {'name': _('Wednesday Evening'), 'dayofweek': '2', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
            (0, 0, {'name': _('Thursday Morning'), 'dayofweek': '3', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
            (0, 0, {'name': _('Thursday Evening'), 'dayofweek': '3', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
            (0, 0, {'name': _('Friday Morning'), 'dayofweek': '4', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
            (0, 0, {'name': _('Friday Evening'), 'dayofweek': '4', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'})
        ]

    def acs_get_booking_price(self):
        for rec in self:
            product = self.env.user.sudo().company_id.booking_product_id
            #ACS Note: Check if department is needed
            # if rec.department_id and rec.department_id.consultaion_service_id:
            #     product = rec.department_id.consultaion_service_id
            if not product:
                raise UserError(_('Please define Booking Service product from Settings.'))
            price = product.list_price
            if hasattr(product, '_acs_get_partner_price'):
                price = product._acs_get_partner_price()
            rec.price = price

    name = fields.Char(required=True)
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.company, required=True)
    schedule_lines_ids = fields.One2many(
        'acs.schedule.lines', 'acs_schedule_id', string='Schedule Lines',
        copy=True, default=acs_get_default_schedule_lines)
    booking_tz = fields.Selection(
        _tz_get, string='Timezone', required=True, default=lambda self: self.env.user.tz,
        help="Timezone where booking takes place")
    department_id = fields.Many2one('hr.department')
    active = fields.Boolean(string="Active", default=True)
    schedule_type = fields.Selection([('service','Service')], string="Schedule Type", default="service")
    show_fee_on_booking = fields.Boolean("Show Fees")
    user_ids = fields.Many2many('res.users', 'acs_schedule_user_rel', 'schedule_id', 'user_id', 'Users')
    price = fields.Float(compute="acs_get_booking_price", string="Fees")
    acs_own_schedule = fields.Boolean("Own Schedule")

    @api.model
    def default_get(self, fields):
        res = super(ACSSchedule, self).default_get(fields)
        if self._context.get('acs_own_scheduling'):
            res['user_ids'] = [(6,0,[self.env.user.id])]
            res['acs_own_schedule'] = True
        return res
    
    #ACS; Can be splited in related module if needed.
    #To Avoid code duplication in mobile api.
    def acs_get_slot_lines(self, **args):
        physician_id = args.get('physician_id')
        department_id = args.get('department_id')
        date = args.get('date')
        schedule_type = args.get('schedule_type','service')
        collection_center_id = args.get('collection_center_id')

        if date:
            domain = [('acs_slot_id.slot_date','=', date),('rem_limit','>=',1),('from_slot','>=',fields.Datetime.now())]
        else:
            last_date = fields.Date.today() + timedelta(days=self.env.user.sudo().company_id.acs_allowed_booking_online_days)
            domain = [('acs_slot_id.slot_date','>=',fields.Date.today()),('from_slot','>=',fields.Datetime.now()),('acs_slot_id.slot_date','<=',last_date)]

        if physician_id:
            domain += [('physician_id', '=', int(physician_id))]
        if department_id:
            domain += [('department_id', '=', int(department_id))]
        if collection_center_id:
            domain += [('acs_slot_id.schedule_id.collection_center_id', '=', int(collection_center_id))]

        domain += [('acs_slot_id.acs_schedule_id.schedule_type', '=', schedule_type)]
        slot_lines = self.env['acs.schedule.slot.lines'].sudo().search(domain)
        return slot_lines   

    #To Avoid code duplication in mobile api also 
    #some parameters are not generic but to avoid duplication it is kept as it is.
    def acs_get_slot_data(self, **args):
        '''Pass following parametes in args:
            physician_id: Search By dr.
            department_id: Search By Deparment.
            date: for specific date
            schedule_type: by schedule type
            collection_center_id: for specific collection center used in lab.
        '''
        slot_lines = self.acs_get_slot_lines(**args)
        slot_data = []
        for slot in slot_lines:
            physician_field_exisits = True if 'physician_id' in slot._fields else False
            slot_data.append({
                'date': slot.acs_slot_id.slot_date.strftime('%m/%d/%Y'),
                'name': slot.name,
                'id': slot.id,
                'physician_id': physician_field_exisits and slot.physician_id.id or False,
                'physician_name': physician_field_exisits and slot.physician_id and slot.physician_id.name or '',
                'fees': slot.acs_slot_id.acs_schedule_id.price,
                'show_fees': slot.acs_slot_id.acs_schedule_id.show_fee_on_booking,
            })
        return slot_data

    def acs_get_disabled_dates(self, **args):
        date = args.get('date')
        slot_lines = self.acs_get_slot_lines(**args)
        dates = slot_lines.mapped('acs_slot_id.slot_date')
        available_dates = []
        for av_date in dates:
            available_dates.append(fields.Date.to_string(av_date))

        disabled_dates = []
        if date and slot_lines: 
            return []
        for days in range(0, self.env.user.sudo().company_id.acs_allowed_booking_online_days + 1):
            date = fields.Date.to_string(fields.Date.today() + timedelta(days=days))
            if date not in available_dates:
                disabled_dates.append(date)
        return disabled_dates


class ACSscheduleLines(models.Model):
    _name = "acs.schedule.lines"
    _description = "Booking schedule Lines"
    _order = 'dayofweek, hour_from'

    name = fields.Char(required=True)
    dayofweek = fields.Selection([
        ('0', 'Monday'),
        ('1', 'Tuesday'),
        ('2', 'Wednesday'),
        ('3', 'Thursday'),
        ('4', 'Friday'),
        ('5', 'Saturday'),
        ('6', 'Sunday')
        ], 'Day of Week', required=True, index=True, default='0')
    hour_from = fields.Float(string='Work from', required=True, index=True, help="Start and End time of working.")
    hour_to = fields.Float(string='Work to', required=True)
    day_period = fields.Selection([('morning', 'Morning'), ('afternoon', 'Afternoon')], required=True, default='morning')
    acs_schedule_id = fields.Many2one("acs.schedule", string="Schedule", required=True, ondelete="cascade")
    show_fee_on_booking = fields.Boolean(related="acs_schedule_id.show_fee_on_booking", string="Show Fees", store=True)


class ACSscheduleSlot(models.Model):
    _name = "acs.schedule.slot"
    _description = "Schedule Slot"
    _rec_name = 'slot_date'

    slot_date = fields.Date(string='Slot Date')
    booking_tz = fields.Selection(_tz_get, string='Timezone', required=True, default=lambda self: self.env.user.tz,
        help="Timezone where booking take place")
    slot_ids = fields.One2many('acs.schedule.slot.lines', 'acs_slot_id', string="Slot Lines")

    acs_schedule_id = fields.Many2one("acs.schedule", string="Booking schedule", required=True, ondelete="cascade")
    show_fee_on_booking = fields.Boolean(related="acs_schedule_id.show_fee_on_booking", string="Show Fees", store=True)

    _sql_constraints = [('slot_date_unique', 'UNIQUE(slot_date, acs_schedule_id)', 'Booking slot must be unique!')]

    def acs_get_slot_line_data(self, slot, from_slot, to_slot, **kw):
        line_data = {
            'from_slot': from_slot,
            'to_slot': to_slot,
            'acs_slot_id': slot.id,
            'limit': kw.get('limit'),
            'user_id': self.env.user.id or False, #Check why user id is used
        }
        if kw.get('limit'):
            line_data['limit'] = kw.get('limit')
        return line_data

    def _create_slot_interval(self, slot, start_dt, hour_from, hour_to, booking_slot_time, **kw):
        #assert start_dt.tzinfo
        combine = datetime.datetime.combine
        SlotLine = self.env['acs.schedule.slot.lines']

        # express all dates and times in the resource's timezone
        tz = timezone(slot.booking_tz or self.env.user.tz)

        start = start_dt #.date()
        #run_time = hour_from
        while (hour_from < hour_to):
            time_hour_from = float_to_time(hour_from)
            hour_from += booking_slot_time/60
            time_hour_to = float_to_time(hour_from)

            # hours are interpreted in the resource's timezone
            start_date = tz.localize(combine(start, time_hour_from)).astimezone(pytz.utc).strftime(DEFAULT_SERVER_DATETIME_FORMAT)
            end_date = tz.localize(combine(start, time_hour_to)).astimezone(pytz.utc).strftime(DEFAULT_SERVER_DATETIME_FORMAT)
            
            #odoo17 check and set limit based on typq
            #limit = limit or self.env.user.sudo().company_id.acs_allowed_booking_per_slot
            line_data = self.acs_get_slot_line_data(slot, start_date, end_date, **kw)
            SlotLine.create(line_data)
        return True

    @api.model
    def create_slot(self, slot_date, schedule, booking_slot_time=False, **kw): 
        ScheduleLines = self.env['acs.schedule.lines']
        booking_slot_time = booking_slot_time or self.env.user.sudo().company_id.acs_booking_slot_time
        weekday = slot_date.weekday()
        slot = self.env['acs.schedule.slot'].create({
            'slot_date': slot_date.strftime(DEFAULT_SERVER_DATE_FORMAT),
            'booking_tz': schedule.booking_tz,
            'acs_schedule_id': schedule.id
        })
        for line in ScheduleLines.search([('acs_schedule_id','=',schedule.id),('dayofweek','=',str(weekday))]):
            #odoo17: Check and manage filed in related module or add field in default.
            physician_ids = kw.get('physician_ids')
            if not physician_ids and  hasattr(schedule, 'physician_ids') and schedule.physician_ids:
                physician_ids = schedule.physician_ids
            if physician_ids:
                for physician_id in physician_ids:
                    newkw = kw
                    newkw['physician_id'] = physician_id
                    self._create_slot_interval(slot, slot_date, line.hour_from, line.hour_to, booking_slot_time, **newkw)
            else:
                self._create_slot_interval(slot, slot_date, line.hour_from, line.hour_to, booking_slot_time, **kw)

    @api.model
    def weekly_slot_create_cron(self):
        ScheduleSlot = self.env['acs.schedule.slot']
        # get day of next week
        next_slot = datetime.datetime.now().date() + datetime.timedelta(days=self.env.user.sudo().company_id.acs_allowed_booking_per_slot)
        schedules = self.env['acs.schedule'].search([])
        for schedule in schedules:
            slot_found = ScheduleSlot.search([('acs_schedule_id','=',schedule.id), ('slot_date','=',next_slot.strftime(DEFAULT_SERVER_DATE_FORMAT))])
            if slot_found:
                _logger.warning('Slot exist for date %s.' % slot_found.slot_date)
            else:
                self.create_slot(next_slot, schedule)


class ACSscheduleSlotLines(models.Model):
    _name = "acs.schedule.slot.lines"
    _description = "schedule Slot Lines"
    _order = 'from_slot'

    @api.depends('from_slot','to_slot')
    def _get_slot_name(self):
        for rec in self:
            name = ''
            if rec.id and rec.from_slot and rec.to_slot:
                tz_info = pytz.timezone(rec.acs_slot_id.booking_tz or self.env.user.tz or self.env.context.get('tz')  or 'UTC')
                from_slot = pytz.UTC.localize(rec.from_slot.replace(tzinfo=None), is_dst=False).astimezone(tz_info).replace(tzinfo=None)
                to_slot = pytz.UTC.localize(rec.to_slot.replace(tzinfo=None), is_dst=False).astimezone(tz_info).replace(tzinfo=None)
                name = from_slot.strftime("%H:%M") + ' - ' + to_slot.strftime("%H:%M")
            rec.name = name

    #updtae in related module.
    #Check if multiple module linked it is getting updated or not.
    def _acs_limit_count(self):
        for slot in self:
            slot.rem_limit = 1

    def _get_booking_price(self):
        for rec in self:
            product = self.env.user.sudo().company_id.booking_product_id
            if not product:
                raise UserError(_('Please define Booking Service product from  Settings.'))
            price = product.list_price
            if hasattr(product, '_acs_get_partner_price'):
                price = product._acs_get_partner_price()
            rec.price = price

    name = fields.Char(string='name', compute='_get_slot_name')
    from_slot = fields.Datetime(string='Starting Slot')
    user_id = fields.Many2one('res.users','Assignee')
    to_slot = fields.Datetime(string='End Slot')
    limit = fields.Integer(string='Limit', default=lambda self: self.env.user.company_id.acs_allowed_booking_per_slot)
    rem_limit = fields.Integer(compute="_acs_limit_count",string='Remaining Limit',store=True)
    acs_slot_id = fields.Many2one('acs.schedule.slot', string="Slot", ondelete="cascade")
    price = fields.Float(compute="_get_booking_price", string="Appointment Fees")

    @api.model
    def default_get(self, fields):
        res = super(ACSscheduleSlotLines, self).default_get(fields)
        if self._context.get('acs_own_scheduling'):
            res['user_id'] = self.env.user.sudo().id
        return res

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: