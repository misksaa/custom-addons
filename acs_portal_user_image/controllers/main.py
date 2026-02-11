# -*- coding: utf-8 -*-

from odoo import http, fields, _
from odoo.http import request,route
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from odoo.exceptions import AccessError, MissingError
from odoo.addons.portal.controllers.portal import CustomerPortal, pager as portal_pager, get_records_pager
from odoo import fields as odoo_fields, http, tools, _, SUPERUSER_ID
import base64

class HMSPortal(CustomerPortal):

    #User Profile image update
    @http.route()
    def account(self, redirect=None, **post):
        values = self._prepare_portal_layout_values()
        partner = request.env.user.partner_id
        values.update({
            'error': {},
            'error_message': [],
        })

        if post and request.httprequest.method == 'POST':
            error, error_message = self.details_form_validate(post)
            values.update({'error': error, 'error_message': error_message})
            values.update(post)
            if not error:
                values = {key: post[key] for key in self.MANDATORY_BILLING_FIELDS}
                values.update({key: post[key] for key in self.OPTIONAL_BILLING_FIELDS if key in post})
                if values.get('image_1920'):
                    values.update({'image_1920': base64.b64encode(values.get('image_1920').read())})
                elif 'image_1920' in values:
                    values.pop('image_1920')

                values.update({'country_id': int(values.pop('country_id', 0))})
                values.update({'zip': values.pop('zipcode', '')})
                if values.get('state_id') == '':
                    values.update({'state_id': False})
                partner.sudo().write(values)
                if redirect:
                    return request.redirect(redirect)
                return request.redirect('/my/home')

        countries = request.env['res.country'].sudo().search([])
        states = request.env['res.country.state'].sudo().search([])


        values.update({
            'partner': partner,
            'countries': countries,
            'states': states,
            'has_check_vat': hasattr(request.env['res.partner'], 'check_vat'),
            'redirect': redirect,
            'page_name': 'my_details',
        })

        response = request.render("portal.portal_my_details", values)
        response.headers['X-Frame-Options'] = 'DENY'
        return response


    MANDATORY_BILLING_FIELDS = ["name", "phone", "street", "city", "country_id"]
    OPTIONAL_BILLING_FIELDS = ["zipcode", "state_id", "vat", "email", "company_name", "image_1920"]

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: