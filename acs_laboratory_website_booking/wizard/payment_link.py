# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from werkzeug import urls

from odoo import api, fields, models, _


class PaymentLinkWizard(models.TransientModel):
    _inherit = 'payment.link.wizard'

    def _get_payment_provider_available(self, **kwargs):
        if kwargs.get('res_model') == 'acs.laboratory.request':
            kwargs['acs_laboratoryrequest_id'] = kwargs.get('res_id')
        return super()._get_payment_provider_available(**kwargs)

    def _get_additional_link_values(self):
        """ Override of `payment` to add `acs_laboratory_request_id` to the payment link values.

        The other values related to the laboratory request from _get_default_payment_link_values.

        Note: self.ensure_one()

        :return: The additional payment link values.
        :rtype: dict
        """
        res = super()._get_additional_link_values()
        if self.res_model != 'acs.laboratory.request':
            return res

        # Order-related fields are retrieved in the controller
        return {
            'acs_laboratoryrequest_id': self.res_id,
        }
