# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT,DEFAULT_SERVER_DATE_FORMAT


class AcsSchedulerWizard(models.TransientModel):
    _inherit = 'acs.scheduler.wizard'

    department_id = fields.Many2one('hr.department', string="Department")
    physician_ids = fields.Many2many('hms.physician', string="Physicians")

    @api.model
    def default_get(self, fields):
        res = super(AcsSchedulerWizard, self).default_get(fields)
        if self._context.get('acs_own_scheduling'):
            res['physician_ids'] = self.env.user.sudo().physician_ids.ids
        return res

    @api.onchange('schedule_id')
    def onchange_schedule(self):
        super(AcsSchedulerWizard, self).onchange_schedule()
        if self.schedule_id and self.schedule_id.company_id and self.schedule_id.schedule_type=='appointment':
            company_id = self.schedule_id.company_id
            self.booking_slot_time = company_id.hms_app_booking_slot_time
            self.acs_allowed_booking_per_slot = company_id.hms_app_allowed_booking_per_slot
            self.department_id = self.schedule_id.department_id and self.schedule_id.department_id.id or False
            self.physician_ids = [(6,0,self.schedule_id.physician_ids.ids)]
    
    def get_slot_args(self):
        slot_args = super(AcsSchedulerWizard, self).get_slot_args()
        slot_args.update({
            'physician_ids': self.physician_ids, 
            'department_id': self.department_id
        })
        return slot_args
