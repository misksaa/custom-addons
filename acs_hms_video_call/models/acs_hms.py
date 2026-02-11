#-*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HmsAppointment(models.Model):
    _inherit = 'hms.appointment'

    calendar_event_id = fields.Many2one('calendar.event', string='Video Call')
    video_call_link = fields.Char(related="calendar_event_id.videocall_location", string="Video Call Link", readonly=True)

    def appointment_confirm(self):
        super(HmsAppointment, self).appointment_confirm()
        if self.is_video_call:
            self.create_video_call()
            template = self.env.ref('acs_hms_video_call.acs_video_call_invitaion')
            template.sudo().send_mail(self.id, raise_exception=False)

    def create_video_call(self):
        video_call = self.env['calendar.event'].create({
            'user_id': self.env.user.id,
            'partner_ids': [(6,0,[self.patient_id.partner_id.id, self.physician_id.partner_id.id])],
            'name': _('Video Consultation for Appointment ') + self.name,
            'start': self.date,
            'stop': self.date_to,
            'appointment_id': self.id,
        })
        video_call._set_discuss_videocall_location()
        self.calendar_event_id = video_call.id

    def consultation_done(self):
        if self.calendar_event_id:
            self.calendar_event_id.action_done()
        return super(HmsAppointment, self).consultation_done()

    def get_partner_ids(self):
        partner_ids = ','.join(map(lambda x: str(x.id), [self.patient_id.partner_id,self.physician_id.partner_id]))
        return partner_ids

    def action_send_invitaion(self):
        '''
        This function opens a window to compose an email, with the template message loaded by default
        '''
        self.ensure_one()
        template_id = self.env['ir.model.data']._xmlid_to_res_id('acs_hms_video_call.acs_video_call_invitaion', raise_if_not_found=False)
        ctx = {
            'default_model': 'hms.appointment',
            'default_res_ids': self.ids,
            'default_use_template': bool(template_id),
            'default_template_id': template_id,
            'default_composition_mode': 'comment',
            'force_email': True
        }
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'mail.compose.message',
            'views': [(False, 'form')],
            'view_id': False,
            'target': 'new',
            'context': ctx,
        }

