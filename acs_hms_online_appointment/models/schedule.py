# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class AcsSchedule(models.Model):
    _inherit = "acs.schedule"

    #odoo17 check and do needed update
    # def _get_booking_price(self):
    #     for rec in self:
    #         product = self.env.user.sudo().company_id.consultation_product_id
    #         if rec.department_id and rec.department_id.consultaion_service_id:
    #             product = rec.department_id.consultaion_service_id
    #         if not product:
    #             raise UserError(_('Please define Consultation Service product from HMS Settings or in the respective department.'))
    #         rec.appointment_price = product._acs_get_partner_price()

    schedule_type = fields.Selection(selection_add=[('appointment','Appointment')])
    physician_ids = fields.Many2many('hms.physician', 'physician_schedule_rel', 'schedule_id', 'physician_id', 'Physicians')

    @api.model
    def default_get(self, fields):
        res = super(AcsSchedule, self).default_get(fields)
        if self._context.get('acs_own_scheduling') and self.env.user.sudo().physician_ids:
            res['physician_ids'] = [(6,0,self.env.user.sudo().physician_ids.ids)]
        return res


class AcsScheduleSlot(models.Model):
    _inherit = "acs.schedule.slot"

    def acs_get_slot_line_data(self, slot, from_slot, to_slot, **kw):
        line_data = super().acs_get_slot_line_data(slot, from_slot, to_slot, **kw)
        if kw.get('physician_id'):
            line_data['physician_id'] = kw.get('physician_id').id
        if kw.get('department_id'):
            line_data['department_id'] = kw.get('department_id').id
        return line_data


class AcsScheduleSlotLines(models.Model):
    _inherit = 'acs.schedule.slot.lines'

    @api.depends('appointment_ids','appointment_ids.state')
    def _acs_limit_count(self):
        super()._acs_limit_count()
        for slot in self.sudo():
            if slot.acs_slot_id.acs_schedule_id.schedule_type=='appointment':
                linked_records = len(self.env['hms.appointment'].sudo().search([('schedule_slot_id','=',slot.id),('state','not in',['draft','cancel'])]))
                slot.rem_limit = slot.limit - linked_records
    
    #odoo17 check and do needed update
    # def _get_booking_price(self):
    #     for rec in self:
    #         product = self.env.user.sudo().company_id.consultation_product_id
    #         if rec.physician_id and rec.physician_id.consultaion_service_id:
    #             product = rec.physician_id.consultaion_service_id
    #         elif rec.department_id and rec.department_id.consultaion_service_id:
    #             product = rec.department_id.consultaion_service_id
    #         if not product:
    #             raise UserError(_('Please define Consultation Service product from HMS Settings or in the respective physician or in department.'))
    #         rec.appointment_price = product._acs_get_partner_price()

    physician_id = fields.Many2one('hms.physician', string='Physician', index=True)
    department_id = fields.Many2one('hr.department', domain=[('patient_department', '=', True)])
    appointment_ids = fields.One2many('hms.appointment', 'schedule_slot_id', string="Appointment")
    resource_type = fields.Selection([
        ('user', 'User'),
        ('physician', 'Physician'),
        ('department', 'Department')
    ], string='Resource Type', default='physician')

    def acs_book_appointment(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.action_appointment")
        action['context'] = {
            'default_department_id': self.department_id.id, 
            'default_physician_id': self.physician_id.id,
            'default_schedule_date': self.acs_slot_id.slot_date,
            'default_date': self.from_slot,
            'default_date_to': self.to_slot,
            'default_schedule_slot_id': self.id,            
        }
        action['views'] = [(self.env.ref('acs_hms.view_hms_appointment_form').id, 'form')]
        return action

    def unlink(self):
        for rec in self:
            if rec.appointment_ids:
                raise UserError(_('You can not delete slot which already have booked appointments.'))
        return super(AcsScheduleSlotLines, self).unlink()

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: