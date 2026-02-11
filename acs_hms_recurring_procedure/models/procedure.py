# -*- coding: utf-8 -*-

from odoo import api, fields, models ,_
from odoo.exceptions import UserError
from datetime import date, datetime, timedelta

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    recurring_procedure = fields.Boolean(string="Recurrent")


class ProcedureGroupLine(models.Model):
    _inherit = 'procedure.group.line'

    recurring_procedure = fields.Boolean(string="Recurrent")

    @api.onchange('product_id')
    def onchange_product(self):
        if self.product_id:
            self.recurring_procedure = self.product_id.recurring_procedure


class HmsTreatment(models.Model):
    _inherit = 'hms.treatment'

    def get_line_data(self, line):
        res = super(HmsTreatment, self).get_line_data(line)
        res['recurring_procedure'] = line.recurring_procedure
        return res


#ACS: we can use procedure insted of procedure to optimize code also.
class AcsPatientProcedure(models.Model):
    _inherit = 'acs.patient.procedure'

    # recurrence fields Taken reference from procedure recurrence
    recurring_procedure = fields.Boolean(string="Recurrent")
    recurring_count = fields.Integer(string="Tasks in Recurrence", compute='_compute_recurring_count')
    recurrence_id = fields.Many2one('acs.procedure.recurrence', copy=False)
    repeat_interval = fields.Integer(string='Repeat Every', default=1, compute='_compute_repeat', readonly=False)
    repeat_unit = fields.Selection([
        ('day', 'Days'),
        ('week', 'Weeks'),
        ('month', 'Months'),
        ('year', 'Years'),
    ], default='week', compute='_compute_repeat', readonly=False)
    repeat_type = fields.Selection([
        ('forever', 'Forever'),
        ('until', 'Until'),
    ], default="forever", string="Until", compute='_compute_repeat', readonly=False)
    repeat_until = fields.Date(string="Recurrence End Date", compute='_compute_repeat', readonly=False)

    @api.model
    def _get_recurrence_fields(self):
        return [
            'repeat_interval',
            'repeat_unit',
            'repeat_type',
            'repeat_until',
        ]

    @api.depends('recurring_procedure')
    def _compute_repeat(self):
        rec_fields = self._get_recurrence_fields()
        defaults = self.default_get(rec_fields)
        for procedure in self:
            for f in rec_fields:
                if procedure.recurrence_id:
                    procedure[f] = procedure.recurrence_id.sudo()[f]
                else:
                    if procedure.recurring_procedure:
                        procedure[f] = defaults.get(f)
                    else:
                        procedure[f] = False

    def _is_recurrence_valid(self):
        self.ensure_one()
        return self.repeat_interval > 0 and\
                (self.repeat_type != 'until' or self.repeat_until and self.repeat_until > fields.Date.today())
    
    @api.depends('recurrence_id')
    def _compute_recurring_count(self):
        self.recurring_count = 0
        recurring_procedures = self.filtered(lambda l: l.recurrence_id)
        count = self.env['acs.patient.procedure']._read_group([('recurrence_id', 'in', recurring_procedures.recurrence_id.ids)], ['recurrence_id'], ['__count'])
        procedures_count = {recurrence.id: count for recurrence, count in count}
        for procedure in recurring_procedures:
            procedure.recurring_count = procedures_count.get(procedure.recurrence_id.id, 0)

    # ------------------------------------------------
    # CRUD overrides
    # ------------------------------------------------
    @api.model
    def default_get(self, default_fields):
        vals = super(AcsPatientProcedure, self).default_get(default_fields)

        if 'repeat_until' in default_fields:
            vals['repeat_until'] = fields.Date.today() + timedelta(days=7)

        return vals

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            # recurrence
            rec_fields = vals.keys() & self._get_recurrence_fields()
            if rec_fields and vals.get('recurring_procedure') is True:
                rec_values = {rec_field: vals[rec_field] for rec_field in rec_fields}
                recurrence = self.env['acs.procedure.recurrence'].create(rec_values)
                vals['recurrence_id'] = recurrence.id

        procedures = super().create(vals_list)
        return procedures

    def write(self, vals):
        # recurrence fields
        rec_fields = vals.keys() & self._get_recurrence_fields()
        if rec_fields:
            rec_values = {rec_field: vals[rec_field] for rec_field in rec_fields}
            for procedure in self:
                if procedure.recurrence_id:
                    procedure.recurrence_id.write(rec_values)
                elif vals.get('recurring_procedure'):
                    recurrence = self.env['acs.procedure.recurrence'].create(rec_values)
                    procedure.recurrence_id = recurrence.id

        if not vals.get('recurring_procedure', True) and self.recurrence_id:
            procedures_in_recurrence = self.recurrence_id.procedure_ids
            self.recurrence_id.unlink()
            procedures_in_recurrence.write({'recurring_procedure': False})

        result = super().write(vals)
        return result

    def unlink(self):
        last_procedure_id_per_recurrence_id = self.recurrence_id._get_last_procedure_id_per_recurrence_id()
        for procedure in self:
            if procedure.id == last_procedure_id_per_recurrence_id.get(procedure.recurrence_id.id):
                procedure.recurrence_id.unlink()
        return super().unlink()

    @api.returns('self', lambda value: value.id)
    def copy(self, default=None):
        if default is None:
            default = {}
        if not default.get('name'):
            default['name'] = _("%s (copy)", self.name)
        if self.recurrence_id:
            default['recurrence_id'] = self.recurrence_id.copy().id
        return super(AcsPatientProcedure, self).copy(default)

    def action_recurring_procedures(self):
        return {
            'name': 'Procedures in Recurrence',
            'type': 'ir.actions.act_window',
            'res_model': 'acs.patient.procedure',
            'view_mode': 'tree,form',
            'context': {'create': False},
            'domain': [('recurrence_id', 'in', self.recurrence_id.ids)],
        }
    
    def action_unlink_recurrence(self):
        self.recurrence_id.procedure_ids.recurring_procedure = False
        self.recurrence_id.unlink()
    
    def action_done(self):
        super().action_done()
        last_procedure_id_per_recurrence_id = self.recurrence_id._get_last_procedure_id_per_recurrence_id()
        for procedure in self:
            if procedure.id == last_procedure_id_per_recurrence_id.get(procedure.recurrence_id.id):
                procedure.recurrence_id._create_next_occurrence(procedure)

    #===========end recurring code=======#
    @api.onchange('product_id')
    def onchange_product(self):
        res = super(AcsPatientProcedure, self).onchange_product()
        if self.product_id:
            self.recurring_procedure = self.product_id.recurring_procedure

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: