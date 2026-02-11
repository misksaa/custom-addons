# -*- coding: utf-8 -*-

from odoo import _, api, models, fields
from odoo.addons import decimal_precision as dp
from odoo.exceptions import ValidationError, UserError
from datetime import date, datetime, timedelta

class AcsSubscription(models.Model):
    _name = 'acs.subscription'
    _description = "Service Subscription"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'id desc'

    STATES = {'active': [('readonly', True)], 'done': [('readonly', True)], 'cancel': [('readonly', True)]}

    @api.depends('res_model_id')
    def _data_count(self):
        Invoice = self.env['account.move']
        record_ids = 0
        for rec in self:
            if rec.res_model_id and rec.res_model_id.model:
                record_ids = self.env[rec.res_model_id.model].search_count([('subscription_id','=',rec.id)])
            rec.record_count = record_ids
            rec.remaining_service = rec.allowed_no_service - record_ids
            rec.invoice_count = Invoice.search_count([('subscription_id', '=', rec.id)])

    number = fields.Char(string='Number', required=True, readonly=True, default="/", tracking=True)
    name = fields.Char(string='Name', related="contract_id.name", readonly=True, tracking=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('done', 'Closed'),
        ('cancel', 'Cancelled'),
    ], string='Status', copy=False, default='draft', tracking=True)

    note = fields.Text('Description')
    partner_id = fields.Many2one('res.partner', string='Customer', ondelete="cascade", required=True)
    allowed_no_service = fields.Integer("Allowed No of Services")
    remaining_service = fields.Integer("Remaining No of Services", compute="_data_count")
    contract_id = fields.Many2one("acs.contract", string="Contract", required=True)
    product_id = fields.Many2one("product.product", related="contract_id.product_id", string="Product",readonly=True)
    start_date = fields.Datetime("Start Date", default=fields.Datetime.now)
    end_date = fields.Datetime("End Date", required=True, default=fields.Datetime.now)
    invoice_count = fields.Integer(string='# of Invoices', compute='_data_count', readonly=True)
    invoice_ids = fields.One2many("account.move", "subscription_id", string='Invoices', copy=False)
    user_id = fields.Many2one('res.users', string='User', default=lambda self: self.env.user.id)

    res_model_id = fields.Many2one('ir.model', related="contract_id.res_model_id", string='Model', readonly=True)
    record_count = fields.Integer(string='# of Operations', compute='_data_count', readonly=True)
    company_id = fields.Many2one('res.company', ondelete='restrict', 
        string='Company', default=lambda self: self.env.company)
    acs_type = fields.Selection([
        ('full', 'Full In Advance'),
        ('discount', 'Price-list Based Discount'),
    ], string='Offer Type', copy=False, default='full', tracking=True)
    pricelist_id = fields.Many2one('product.pricelist', string='Pricelist', check_company=True, 
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            values['number'] = self.env['ir.sequence'].next_by_code('acs.subscription') or '/'
        return super().create(vals_list)

    def unlink(self):
        for rec in self:
            if rec.state not in ('draft', 'cancel'):
                raise UserError(_('You cannot delete an record which is not draft or canceled.'))
        return super(AcsSubscription, self).unlink()

    def _compute_display_name(self):
        for record in self:
            name = " [%(number)s] %(name)s (%(count)s)" % {
                'name': record.name,
                'number': record.number,
                'count': _('%g remaining out of %g') % (record.remaining_service or 0.0, record.allowed_no_service or 0.0)
            }
            record.display_name = name

    def action_confirm(self):
        self.state = 'active'

    def action_done(self):
        self.state = 'done'

    def action_draft(self):
        self.state = 'draft'

    def action_cancel(self):
        self.state = 'cancel'

    @api.onchange("contract_id")
    def onchange_contract_id(self):
        if self.contract_id:
            self.allowed_no_service = self.contract_id.no_service
            self.acs_type = self.contract_id.acs_type
            self.pricelist_id = self.contract_id.pricelist_id and self.contract_id.pricelist_id.id or False

    def action_view_related_records(self):
        record_ids = self.env[self.res_model_id.model].search([('subscription_id','=',self.id)])
        return {
            'name':'Records',
            'view_type': 'form',
            'view_mode': 'tree,form',
            'res_model': self.res_model_id.model,
            'target': 'current',
            'type': 'ir.actions.act_window',
            'domain': [('id','in', record_ids.ids)],
            'nodestroy': True,
        }

    def action_invoice_create(self):
        product_id = self.product_id
        if not product_id:
            raise UserError(_("Please Set proper contract first."))

        lines = [(0, 0, {
            'name': product_id.name + '\n' + 'Subscription No: ' + self.number,
            'product_id': product_id.id,
            'quantity' : 1,
            'price_unit' : self.contract_id.price or product_id.list_price,
            'product_uom_id': product_id.uom_id.id,
        })]
        
        move_id = self.env['account.move'].create({
            'partner_id': self.partner_id.id,
            'move_type': 'out_invoice',
            'currency_id': self.company_id.currency_id.id,
            'invoice_line_ids': lines,
        })
        move_id.subscription_id = self.id
        action = self.env["ir.actions.actions"]._for_xml_id("account.action_move_out_invoice_type")
        action['views'] = [(self.env.ref('account.view_move_form').id, 'form')]
        action['res_id'] = move_id.id
        return action

    def action_view_invoice(self):
        action = self.env["ir.actions.actions"]._for_xml_id("account.action_move_out_invoice_type")
        action['views'] = [(self.env.ref('account.view_move_form').id, 'form')]
        action['domain'] = [('subscription_id','=',self.id)]
        return action

    #This is lazy option to close subscriptions
    @api.model
    def close_subscriptions(self):
        subscriptions = self.search([('state','=','active'),('end_date','<=',fields.Datetime.now())])
        for subscription in subscriptions:
            subscription.action_done()

        subscriptions = self.search([('state','=','active'),('end_date','>=',fields.Datetime.now())])
        for subscription in subscriptions:
            if subscription.remaining_service <= 0:
                subscription.action_done()

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: