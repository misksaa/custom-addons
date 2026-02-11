# -*- encoding: utf-8 -*-
from odoo import api, fields, models,_
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = "res.company"

    acs_allowed_booking_online_days = fields.Integer("Website Allowed Advance Booking Days", help="No of days for which advance booking is allowed", default=7)
    acs_booking_slot_time = fields.Integer("Website Minutes in each slot", help="Configure your slot length, 15-30min.", default=15)
    acs_allowed_booking_per_slot = fields.Integer("Website Allowed Booking per Slot", help="No of allowed booking per slot.", default=4)
    acs_allowed_booking_payment = fields.Boolean("Website Allowed Advance Booking Payment", help="Allow user to do online Payment")
    booking_product_id = fields.Many2one('product.product', "WebsiteBooking Product")

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    acs_allowed_booking_online_days = fields.Integer(related='company_id.acs_allowed_booking_online_days',
        string='Website Allowed Advance Booking Days', readonly=False)
    acs_booking_slot_time = fields.Integer(related='company_id.acs_booking_slot_time',
        string='Website Minutes in each slot', readonly=False)
    acs_allowed_booking_per_slot = fields.Integer(related='company_id.acs_allowed_booking_per_slot',
        string='Website Allowed Booking per Slot', readonly=False)

    acs_allowed_booking_payment = fields.Boolean(related='company_id.acs_allowed_booking_payment',
        string='Website Allowed Advance Booking Payment', readonly=False)
    booking_product_id = fields.Many2one('product.product', 'Website Booking Product', related='company_id.booking_product_id', readonly=False)
