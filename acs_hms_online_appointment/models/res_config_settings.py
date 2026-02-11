# -*- encoding: utf-8 -*-
from odoo import api, fields, models,_
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = "res.company"

    hms_app_allowed_advance_booking_days = fields.Integer("Allowed Advance Booking Days", help="No of days for which advance booking is allowed", default=7)
    hms_app_booking_slot_time = fields.Integer("Minutes in each slot", help="Configure your slot length, 15-30min.", default=15)
    hms_app_allowed_booking_per_slot = fields.Integer("Allowed Booking per Slot", help="No of allowed booking per slot.", default=4)
    hms_app_allowed_booking_payment = fields.Boolean("Allowed Advance Booking Payment", help="Allow user to do online Payment")
    acs_hms_app_tc = fields.Char('Terms & Conditions Page link', default="/appointment/terms")
    acs_hms_app_allowed_video_consultation = fields.Boolean("Allowed Online Consultation", help="Allowed Online Consultation")


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    hms_app_allowed_advance_booking_days = fields.Integer(related='company_id.hms_app_allowed_advance_booking_days',
        string='Allowed Advance Booking Days', readonly=False)
    hms_app_booking_slot_time = fields.Integer(related='company_id.hms_app_booking_slot_time',
        string='Minutes in each slot', readonly=False)
    hms_app_allowed_booking_per_slot = fields.Integer(related='company_id.hms_app_allowed_booking_per_slot',
        string='Allowed Booking per Slot', readonly=False)

    hms_app_allowed_booking_payment = fields.Boolean(related='company_id.hms_app_allowed_booking_payment',
        string='Allowed Advance Booking Payment', readonly=False)
    acs_hms_app_tc = fields.Char(related='company_id.acs_hms_app_tc',
        string='Terms & Conditions Page link', readonly=False)
    acs_hms_app_allowed_video_consultation = fields.Boolean(related='company_id.acs_hms_app_allowed_video_consultation', 
        string="Allowed Online Consultation", help="Allowed Online Consultation", readonly=False)

