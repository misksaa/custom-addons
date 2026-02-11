# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT,DEFAULT_SERVER_DATE_FORMAT


class AcsSchedulerWizard(models.TransientModel):
    _name = 'acs.scheduler.wizard'
    _description = 'acs Scheduler Wiz'

    schedule_id = fields.Many2one("acs.schedule", string="Schedule", required=True, ondelete="cascade")
    start_date = fields.Date('Start Date', required=True, default=fields.Date.today)
    end_date = fields.Date('End Date',required=True)
    booking_slot_time = fields.Integer("Minutes in each slot", help="Configure your slot length, 15-30min.")
    acs_allowed_booking_per_slot = fields.Integer("Allowed Booking per Slot", help="No of allowed booking per slot.")
    user_ids = fields.Many2many('res.users', string="Users")
    acs_own_schedule = fields.Boolean("Own Schedule")
    schedule_ids = fields.Many2many("acs.schedule", "wiz_acs_schedule_rel", "wiz_id", "schedule_id", compute="get_schedule_ids", string="schedules")

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for wizard in self:
            if wizard.start_date > wizard.end_date:
                raise ValidationError(_("Scheduler 'Start Date' must be before 'End Date'."))
        return True

    #ACS: Can be dpne by adding two fields in view with domain and optinal show. but it was applying same 
    #domain on both fields so done with extra m2m field.
    @api.depends('acs_own_schedule')
    def get_schedule_ids(self):
        Schedule = self.env['acs.schedule']
        for rec in self:
            domain = []
            if rec.acs_own_schedule:
                domain = [('acs_own_schedule','=',True),('user_ids','in',[self.env.user.id])]
            rec.schedule_ids = Schedule.search(domain)

    @api.model
    def default_get(self, fields):
        res = super(AcsSchedulerWizard, self).default_get(fields)
        if self._context.get('acs_own_scheduling'):
            res['acs_own_schedule'] = True
        return res

    @api.onchange('schedule_id')
    def onchange_schedule(self):
        company_id = self.env.user.company_id
        if self.schedule_id and self.schedule_id.company_id:
            company_id = self.schedule_id.company_id
            self.booking_slot_time = company_id.acs_booking_slot_time
            self.acs_allowed_booking_per_slot = company_id.acs_allowed_booking_per_slot

    def get_slot_args(self):
        return {'limit': self.acs_allowed_booking_per_slot}

    def acs_slot_create_wizard(self):
        Slot = self.env['acs.schedule.slot']
        # create slot
        start_date = self.start_date
        end_date = self.end_date

        while (start_date != end_date + timedelta(days=1)):
            slot_found = Slot.search([('acs_schedule_id','=',self.schedule_id.id), ('slot_date','=',start_date.strftime(DEFAULT_SERVER_DATE_FORMAT))])
            if slot_found:
                raise UserError(_("Slot exist for date %s." % start_date.strftime(DEFAULT_SERVER_DATE_FORMAT)))
            slot_args = self.get_slot_args()
            Slot.create_slot(start_date, self.schedule_id, self.booking_slot_time, **slot_args)
            start_date = start_date  + timedelta(days=1)
        end_scheduler =(end_date - timedelta(days=7)).strftime(DEFAULT_SERVER_DATE_FORMAT)