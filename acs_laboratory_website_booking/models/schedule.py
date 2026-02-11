# -*- coding: utf-8 -*-

from odoo import api, fields, models, _

class Acsschedule(models.Model):
    _inherit = "acs.schedule"

    schedule_type = fields.Selection(selection_add=[('laboratory','Laboratory')])
    collection_center_id = fields.Many2one('acs.laboratory', string="Collection Center")
    physician_ids = fields.Many2many('hms.physician', 'physician_acs_schedule_rel', 'schedule_id', 'physician_id', 'Physicians')

class AcsScheduleSlotLines(models.Model):
    _inherit = 'acs.schedule.slot.lines'

    @api.depends('laboratory_request_ids','laboratory_request_ids.state')
    def _acs_limit_count(self):
        super()._acs_limit_count()
        for slot in self.sudo():
            if slot.acs_slot_id.acs_schedule_id.schedule_type=='laboratory':
                linked_records = len(self.env['acs.laboratory.request'].sudo().search([('schedule_slot_id','=',slot.id),('state','!=','canceled')]))
                slot.rem_limit = slot.limit - linked_records

    laboratory_request_ids = fields.One2many('acs.laboratory.request', 'schedule_slot_id', string="Lab Requests")