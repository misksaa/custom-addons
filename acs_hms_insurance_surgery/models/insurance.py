# -*- coding: utf-8 -*-

from odoo import api, fields, models, _


class InsuranceClaim(models.Model):
    _inherit = 'hms.insurance.claim'

    surgery_id = fields.Many2one('hms.surgery', string='Surgery')
    claim_for = fields.Selection(selection_add=[('surgery', 'Surgery')])


class InsurancePlan(models.Model):
    _inherit = 'acs.insurance.plan'

    allow_surgery_insurance = fields.Boolean(string="Insured Surgery", default=False)
    surgery_insurance_type = fields.Selection([
        ('percentage', 'Percentage'),
        ('fix', 'Fix-amount')], 'Surgery Insurance Type', default='percentage', required=True)
    surgery_insurance_amount = fields.Float(string="Surgery Co-payment", help="The patient should pay specific amount 50QR")
    surgery_insurance_percentage = fields.Float(string="Surgery Insured Percentage")
    surgery_insurance_limit = fields.Float(string="Surgery Insurance Limit")
    surgery_create_claim = fields.Boolean(string="Surgery Create Claim", default=False)


class Insurance(models.Model):
    _inherit = 'hms.patient.insurance'

    allow_surgery_insurance = fields.Boolean(string="Insured Surgery", default=False)
    surgery_insurance_type = fields.Selection([
        ('percentage', 'Percentage'),
        ('fix', 'Fix-amount')], 'Surgery Insurance Type', default='percentage', required=True)
    surgery_insurance_amount = fields.Float(string="Surgery Co-payment", help="The patient should pay specific amount 50QR")
    surgery_insurance_percentage = fields.Float(string="Surgery Insured Percentage")
    surgery_insurance_limit = fields.Float(string="Surgery Insurance Limit")
    surgery_create_claim = fields.Boolean(string="Surgery Create Claim", default=False)

    @api.onchange('insurance_plan_id')
    def onchange_insurance_plan(self):
        super().onchange_insurance_plan()
        if self.insurance_plan_id:
            plan_id = self.insurance_plan_id
            self.allow_surgery_insurance = plan_id.allow_surgery_insurance
            self.surgery_insurance_type = plan_id.surgery_insurance_type
            self.surgery_insurance_amount = plan_id.surgery_insurance_amount
            self.surgery_insurance_percentage = plan_id.surgery_insurance_percentage
            self.surgery_insurance_limit = plan_id.surgery_insurance_limit
            self.surgery_create_claim = plan_id.surgery_create_claim
