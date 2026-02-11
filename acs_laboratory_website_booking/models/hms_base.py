# -*- encoding: utf-8 -*-

from odoo import api, fields, models, http, tools, _, SUPERUSER_ID
from datetime import timedelta
from odoo.http import request


class AcsLaboratoryRequest(models.Model):
    _inherit = 'acs.laboratory.request'

    patient_count = fields.Integer("Patient Count", default=1)
    schedule_date = fields.Date(string='Schedule Date', readonly=False)
    schedule_slot_id = fields.Many2one('acs.schedule.slot.lines', string = 'Schedule Slot')
    booked_online = fields.Boolean('Booked Online')

    @api.onchange('schedule_date')
    def onchange_schedule_date(self):
        self.schedule_slot_id = False

    @api.onchange('schedule_slot_id')
    def onchange_schedule_slot(self):
        if self.schedule_slot_id:
            self.date = self.schedule_slot_id.from_slot

    #Based on slected collection center update type
    def write(self, vals):
        if 'collection_center_id' in vals and vals.get('collection_center_id'):
            collection_center_id = self.env['acs.laboratory'].sudo().search([('id','=',vals.get('collection_center_id'))])

        if 'schedule_slot_id' in vals and vals.get('schedule_slot_id'):
            schedule_slot_id = self.env['acs.schedule.slot.lines'].sudo().search([('id','=',vals.get('schedule_slot_id'))])
            if schedule_slot_id:
                vals['schedule_date'] = schedule_slot_id.from_slot.date()
                vals['date'] = schedule_slot_id.from_slot

        return super(AcsLaboratoryRequest, self).write(vals)

    @api.model
    def clear_acs_laboratory_request_cron(self):
        records = self.search([('booked_online','=', True),('state','=','draft')])
        for record in records:
            #cancel record after 20 minute if not paid
            create_time = record.create_date + timedelta(minutes=20)
            if create_time <= fields.Datetime.now():
                if record.invoice_id:
                    if record.state=='paid':
                        continue
                    record.invoice_id.action_invoice_cancel()
                record.button_cancel()

    def button_cancel(self):
        res = super(AcsLaboratoryRequest, self).button_cancel()
        self.schedule_slot_id = False
        return res

    def _get_default_payment_link_values(self):
        self.ensure_one()
        return {
            'amount': self.total_price,
            'currency_id': self.company_id.currency_id.id,
            'partner_id': self.patient_id.partner_id.id,
            'amount_max': self.total_price
        }

    def acs_get_booking_record(self):
        booking_record = self.search([('state','=','draft'),('patient_id.user_id','=',self.env.user.id)], limit=1)
        acs_patient_id = self.env.user.sudo().partner_id.acs_patient_id
        if not booking_record and acs_patient_id:
            booking_record = self.with_user(SUPERUSER_ID).create({
                'patient_id': acs_patient_id.id,
                'booked_online': True,
            })
        return booking_record


class AcsLabTest(models.Model):
    _inherit = 'acs.lab.test'

    image_1920 = fields.Image("Image")
    allowed_online_booking = fields.Boolean("Allowed Online Booking")


class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    acs_laboratoryrequest_id = fields.Many2one("acs.laboratory.request", string="Lab Request")

    #Update Payments directs after successful payment.
    def _reconcile_after_done(self):
        for tx in self.filtered(lambda t: t.operation != 'validation' and t.acs_laboratoryrequest_id):
            tx._acs_update_laboratory_request()
        return super(PaymentTransaction, self)._reconcile_after_done()

    #Update Lab request data.
    def _acs_update_laboratory_request(self):
        self.acs_laboratoryrequest_id.sudo().with_context(acs_online_transaction=True,default_create_stock_moves=False).create_invoice()
        if self.acs_laboratoryrequest_id.sudo().state!='confirm':
            self.acs_laboratoryrequest_id.sudo().with_context(acs_online_transaction=True).button_accept()

        # Setup access token in advance to avoid serialization failure between
        # edi postprocessing of invoice and displaying the sale order on the portal
        self.acs_laboratoryrequest_id.invoice_id._portal_ensure_token()
        self.invoice_ids = [(6, 0, [self.acs_laboratoryrequest_id.invoice_id.id])]
