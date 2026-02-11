# -*- coding: utf-8 -*-

from odoo.http import request
from odoo.addons.website.controllers.main import Website
from odoo import fields, http, tools, _, SUPERUSER_ID

class AcsWebsite(Website):
    
    def acs_user_website_booking_data(self, model=False):
        acs_req_id = request.website.acs_get_request(model)
        print ("acs_req_id----",acs_req_id)
        acs_req = False
        if acs_req_id:
            document = request.env[model].browse([acs_req_id])
            document_sudo = document.with_user(SUPERUSER_ID).exists()
            if not document_sudo:
                request.website.acs_request_reset(model)
            acs_req = request.env[model].sudo().search([('id','=',acs_req_id)])
        return acs_req
