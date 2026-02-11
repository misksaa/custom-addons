# -*- encoding: utf-8 -*-

from odoo import api, models, fields, http, tools, _, SUPERUSER_ID
from odoo.http import request


class Website(models.Model):
    _inherit = 'website'

    def acs_get_request(self, model):
        self.ensure_one()
        RequestModel = self.env[model].sudo()
        acs_req_id = request.session.get('acs_req_id')
        if acs_req_id:
            acs_req = RequestModel.search([('id','=',acs_req_id)])
            if acs_req.state!='draft':
                self.acs_request_reset()
                acs_req_id = False

        elif not acs_req_id and not self.env.user._is_public():
            acs_req_id = RequestModel.acs_get_booking_record()
            if acs_req_id:
                request.session['acs_req_id'] = acs_req_id.id
        else:
            request.session['acs_req_id'] = False
        return request.session['acs_req_id']

    def acs_request_reset(self):
        request.session.update({
            'acs_req_id': False,
        })
