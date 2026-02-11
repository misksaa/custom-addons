# -*- coding: utf-8 -*-
from odoo import api, fields, models, _

class AcsSmsTemplate(models.Model):
    _inherit = 'sms.template'

    acs_templateid = fields.Char("Template ID", help="DLT Approved Template ID")

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: