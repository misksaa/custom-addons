# -*- coding: utf-8 -*-

from odoo import http, fields, _
from odoo.http import request
from odoo.addons.portal.controllers.portal import CustomerPortal, pager as portal_pager, get_records_pager
from odoo.addons.payment.controllers import portal as payment_portal
from odoo.addons.website.controllers.main import Website
from odoo.exceptions import AccessError, MissingError
from odoo import fields, http, tools, _, SUPERUSER_ID
from datetime import timedelta


class HMSWebsite(Website):

    def acs_lab_website_data(self, redirect=None, **post):
        company_id = request.env.user.sudo().company_id
        laboratory_request = self.acs_user_website_booking_data(model='acs.laboratory.request')
        values = {
            'payment_step': company_id.acs_allowed_booking_payment,
            'laboratory_request': laboratory_request,
            'redirect': redirect,
            'error_message': post.get('error_message'),
            'patient': request.env.user.acs_patient_id,
            'error': {}
        }
        return values

    @http.route(['/create/lab/appointment'], type='http', auth='public', website=True, sitemap=True)
    def create_lab_appointment(self, redirect=None, **post):
        values = self.acs_lab_website_data(redirect, **post)
        values['locations'] = request.env['acs.laboratory'].sudo().search([('is_collection_center','=',True)])
        return request.render("acs_laboratory_website_booking.lab_appointment_patient_and_location", values)

    @http.route(['/acs/lab/slot'], type='http', auth='public', website=True, sitemap=False)
    def select_lab_slot(self, redirect=None, **post):
        values = self.acs_lab_website_data(redirect, **post)
        laboratory_request = values.get('laboratory_request')
        if not laboratory_request:
            return request.redirect('/')
        data = {}
        if post.get('patient_count'):
            data['patient_count'] = post.get('patient_count')

        if post.get('collection_center_id'):
            data['collection_center_id'] = post.get('collection_center_id')
        if data:
            laboratory_request.sudo().write(data)
 
        schedule_data = {'schedule_type': 'laboratory', 'collection_center_id': laboratory_request.collection_center_id.id}
        values['slots_data'] = request.env['acs.schedule'].acs_get_slot_data(**schedule_data)
        values['disable_dates'] = request.env['acs.schedule'].acs_get_disabled_dates(**schedule_data)
        values['last_date'] = fields.Date.today() + timedelta(days=request.env.user.sudo().company_id.acs_allowed_booking_online_days)
        return request.render("acs_laboratory_website_booking.lab_appointment_slot", values)

    @http.route(['/acs/lab/tests'], type='http', auth='public', website=True, sitemap=False)
    def select_lab_tests(self, redirect=None, **post):
        values = self.acs_lab_website_data(redirect, **post)
        request.website.acs_get_request(model='acs.laboratory.request')
        laboratory_request = values.get('laboratory_request')

        data = {}
        #if post.get('slot_date'):
        #    data['slot_date'] = post.get('slot_date')
        if post.get('schedule_slot_id'):
            data['schedule_slot_id'] = int(post.get('schedule_slot_id'))
        if data:
            laboratory_request.sudo().write(data)
        if not laboratory_request.schedule_slot_id:
            error_message = _("Please Select at least one Slot to proceed ahead.")
            return request.redirect('/acs/lab/slot?error_message=%s' % (error_message))

        values['lab_tests'] = request.env['acs.lab.test'].sudo().search([('allowed_online_booking','=',True)])
        values['currency_id'] = request.env.user.sudo().company_id.currency_id
        return request.render("acs_laboratory_website_booking.lab_appointment_tests", values)

    @http.route(['/acs/lab/patients'], type='http', auth='public', website=True, sitemap=False)
    def select_lab_patients(self, redirect=None, **post):
        values = self.acs_lab_website_data(redirect, **post)
        laboratory_request = values.get('laboratory_request')
        RequestLine = request.env['laboratory.request.line']

        selected_tests = []
        for rec in post:
            vals = rec.split('lab_test-')
            if len(vals)==2:
                selected_tests.append(int(vals[1]))

        if selected_tests:
            laboratory_request.sudo().line_ids.unlink()
            lab_tests = request.env['acs.lab.test'].sudo().search([('id','in',selected_tests)])
            for test in lab_tests:
                line = RequestLine.create({
                    'test_id': test.id,
                    'request_id': laboratory_request.id,
                })
                line.sudo().onchange_test()

        if not laboratory_request.line_ids:
            error_message = _("Please Select at least one Test to proceed ahead.")
            return request.redirect('/acs/lab/tests?error_message=%s' % (error_message))

        values['family_members'] = request.env.user.acs_patient_id and request.env.user.acs_patient_id.family_member_ids or False
        return request.render("acs_laboratory_website_booking.lab_appointment_patients", values)

    @http.route(['/acs/lab/request/confirm'], type='http', auth='public', website=True, sitemap=False)
    def acs_confirm_request(self, redirect=None, **post):
        values = self.acs_lab_website_data(redirect, **post)
        laboratory_request = values.get('laboratory_request')
        Patient = request.env['laboratory.request.line']
        company_id = request.env.user.sudo().company_id

        selected_patients = []
        for rec in post:
            vals = rec.split('patient-')
            if len(vals)==2:
                selected_patients.append(int(vals[1]))

        if selected_patients:
            if len(selected_patients)==1:
                laboratory_request.sudo().write({'is_group_request': False, 'patient_id': selected_patients[0]})
            else:
                if laboratory_request.patient_id.id in selected_patients:
                    user_selected_patients = selected_patients.copy()
                    user_selected_patients.remove(laboratory_request.patient_id.id)
                    data = {'is_group_request': True, 'group_patient_ids': [(6,0, user_selected_patients)]}
                else:
                    data = {'patient_id': selected_patients[0],'is_group_request': True, 'group_patient_ids': [(6,0, selected_patients)]}
                laboratory_request.sudo().write(data)

        if laboratory_request.patient_count!=len(selected_patients):
            error_message = _("Please Select %s Patient to proceed ahead.") % (laboratory_request.patient_count)
            return request.redirect('/acs/lab/patients?error_message=%s' % (error_message))

        laboratory_request.sudo().button_requested()

        if company_id.acs_allowed_booking_payment:
            context = {'active_id': laboratory_request.id, 'active_model': 'acs.laboratory.request'}
            payment_link_wiz = request.env['payment.link.wizard'].sudo().with_context(context).create({})
            #if fee is 0 validate appointment
            if payment_link_wiz.amount==0:
                laboratory_request.sudo().with_context(acs_online_transaction=True).button_accept()
                return request.render("acs_laboratory_website_booking.almightycs_payment_confirm", {'laboratory_request': laboratory_request})

            return request.redirect(payment_link_wiz.link)
        return request.render("acs_laboratory_website_booking.lab_req_thank_you", {'laboratory_request': laboratory_request})


class AcsCustomerPortal(CustomerPortal):

    @http.route(['/my/lab_requests/<model("acs.laboratory.request"):request_id>/payment'], type='http', auth="user", website=True, sitemap=False)
    def lab_request_payment(self, request_id, **kwargs):
        context = {'active_id': request_id.id, 'active_model': 'acs.laboratory.request'}
        payment_link_wiz = request.env['payment.link.wizard'].sudo().with_context(context).create({})
        #if fee is 0 validate appointment
        if payment_link_wiz.amount==0:
            request_id.sudo().with_context(acs_online_transaction=True).button_accept()
            return request.render("acs_laboratory_website_booking.lab_req_thank_you", {'laboratory_request': request_id})
        return request.redirect(payment_link_wiz.link)
    
    @http.route(['/my/lab_requests/<int:request_id>/paid'], type='http', auth="public", website=True, sitemap=False)
    def my_lab_request_paid(self, request_id=None, access_token=None, **kw):
        try:
            record_sudo = self._document_check_access('acs.laboratory.request', request_id, access_token=access_token)
        except (AccessError, MissingError):
            return request.redirect('/my')
        return request.render("acs_laboratory.my_lab_test_request", {'lab_request': record_sudo, 'is_paid': True})


class AcsPaymentPortal(payment_portal.PaymentPortal):

    @http.route(['/my/lab_requests/<model("acs.laboratory.request"):request_id>/paymentprocess'], type='json', auth="public", website=True, sitemap=False)
    def laboratoryrequest_payment_process(self, request_id, access_token, **kwargs):
        logged_in = not request.env.user._is_public()
        partner_sudo = request.env.user.partner_id if logged_in else request_id.patient_id.partner_id
        self._validate_transaction_kwargs(kwargs)
        kwargs.update({
            'partner_id': partner_sudo.id,
            'currency_id': partner_sudo.company_id.currency_id.id,
        })
        tx_sudo = self._create_transaction(
            custom_create_values={'acs_laboratoryrequest_id': request_id.id}, **kwargs,
        )
        return tx_sudo._get_processing_values()

    def _get_extra_payment_form_values(self, **kwargs):
        """ Override of `payment` to reroute the payment flow to the portal view of the sales order.

        :param str sale_order_id: The sale order for which a payment is made, as a `sale.order` id.
        :return: The extended rendering context values.
        :rtype: dict
        """
        form_values = super()._get_extra_payment_form_values(**kwargs)
        acs_laboratoryrequest_id = kwargs.get('acs_laboratoryrequest_id')
        if acs_laboratoryrequest_id:
            acs_laboratoryrequest_id = self._cast_as_int(acs_laboratoryrequest_id)
            order_sudo = request.env['acs.laboratory.request'].sudo().browse(acs_laboratoryrequest_id)

            # Interrupt the payment flow if the sales order has been canceled.
            if order_sudo.state == 'cancel':
                form_values['amount'] = 0.0

            # Reroute the next steps of the payment flow to the portal view of the sales order.
            form_values.update({
                'transaction_route': order_sudo.get_portal_url(suffix='/paymentprocess'),
                'landing_route': order_sudo.get_portal_url(suffix='/paid'),
                'access_token': order_sudo.access_token,
            })
        return form_values
