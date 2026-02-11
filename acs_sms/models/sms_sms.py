# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError
import json

import urllib
from urllib.request import Request, urlopen
import ssl


class MailThread(models.AbstractModel):
    _inherit = 'mail.thread'

    def _message_sms_with_template(self, template=False, template_xmlid=False, template_fallback='', partner_ids=False, **kwargs):
        acs_templateid = False
        if template:
            acs_templateid = template.acs_templateid
        return super(MailThread, self.with_context(acs_templateid=acs_templateid))._message_sms_with_template(template=template, template_xmlid=template_xmlid, template_fallback=template_fallback, partner_ids=partner_ids, **kwargs)
        

class AcsSmsSms(models.Model):
    _inherit = 'sms.sms'

    def _acs_get_url(self):
        for rec in self:
            company = rec.company_id or self.env.company
            prms = {
                company.sms_receiver_param: rec.mobile,
                company.sms_message_param: rec.msg
            }
            if company.sms_sms_user_name_param:
                prms[company.sms_sms_user_name_param] = company.sms_user_name
            if company.sms_password_param:
                prms[company.sms_password_param] = company.sms_password
            if company.sms_sender_param:
                prms[company.sms_sender_param] = company.sms_sender_id
            if company.sms_templateid_param:
                prms[company.sms_templateid_param] = rec.acs_templateid

            params = urllib.parse.urlencode(prms)
            rec.name = company.sms_url + "?" + params + (company.sms_extra_param or '')

    acs_url = fields.Text(string='SMS Request URl', compute="_acs_get_url")
    company_id = fields.Many2one('res.company', string='Company', required=True,
        default=lambda self: self.env.company)
    acs_templateid = fields.Char("Template ID", help="DLT Approved Template ID")
    acs_server_reply = fields.Text("Reply Message")

    #ACS: Replace action to send sms by local API.
    def _send(self, unlink_failed=False, unlink_sent=True, raise_exception=False):
        for rec in self:
            try:
                ssl._create_default_https_context = ssl._create_unverified_context
                rep = urlopen(Request(rec.acs_url, headers={'User-Agent': 'Mozilla/5.0'})).read()
                rec.state = 'sent'
                rec.acs_server_reply = json.loads(rep.decode('utf-8'))
            except Exception as e:
                rec.state = 'error'
                rec.acs_server_reply = Exception

    @api.model_create_multi
    def create(self, vals_list):
        if self.env.context.get('acs_templateid'):
            for val in vals_list:
                val['acs_templateid'] = self.env.context.get('acs_templateid')
        return super().create(vals_list)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: