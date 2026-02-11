# -*- encoding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError
import math, random


class ResPartner(models.Model):
    _inherit = 'res.partner'

    acs_otp_sms = fields.Char(string="OTP SMS", copy=False)
    generated_otp_sms = fields.Char(string="Generated OTP SMS")
    verified_mobile_sms = fields.Boolean(string="Verified SMS", help="The mobile number is verified using the SMS message", default=False)

    def action_send_otp_sms(self):
        for rec in self:
            rec.generateotp_sms()
            verify_otp_msg_sms_template_id = rec.sudo().company_id.verify_otp_msg_sms_template_id or self.env.user.sudo().company_id.verify_otp_msg_sms_template_id
            rec._message_sms_with_template(
                template=verify_otp_msg_sms_template_id,
                template_fallback=_("Dear %(name)s, %(otp)s is your OTP Verification.", name=rec.name, otp=rec.generated_otp_sms),
                partner_ids=[rec.id],
                put_in_queue=False
            )

    def generateotp_sms(self):
        digits = "0123456789"
        otp = ""
        for i in range(4):
            otp += digits[math.floor(random.random() * 10)]
            self.generated_otp_sms = otp

    def action_verify_otp_sms(self):
        if self.acs_otp_sms:
            pass
        else:
            raise UserError(_('Please enter OTP.'))
            
        if self.generated_otp_sms == self.acs_otp_sms:
            self.verified_mobile_sms = True
        else:
            raise UserError(_('The OTP you entered is invalid. Please enter the correct OTP.'))

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: