# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models, Command
from odoo.exceptions import ValidationError

from dateutil.relativedelta import relativedelta


class AcsProcedureRecurrence(models.Model):
    _name = 'acs.procedure.recurrence'
    _description = 'Procedure Recurrence'

    procedure_ids = fields.One2many('acs.patient.procedure', 'recurrence_id')
    repeat_interval = fields.Integer(string='Repeat Every', default=1)
    repeat_unit = fields.Selection([
        ('day', 'Days'),
        ('week', 'Weeks'),
        ('month', 'Months'),
        ('year', 'Years'),
    ], default='week')
    repeat_type = fields.Selection([
        ('forever', 'Forever'),
        ('until', 'Until'),
    ], default="forever", string="Until")
    repeat_until = fields.Date(string="End Date")

    @api.constrains('repeat_interval')
    def _check_repeat_interval(self):
        if self.filtered(lambda t: t.repeat_interval <= 0):
            raise ValidationError(_('The interval should be greater than 0'))

    @api.constrains('repeat_type', 'repeat_until')
    def _check_repeat_until_date(self):
        today = fields.Date.today()
        if self.filtered(lambda t: t.repeat_type == 'until' and t.repeat_until < today):
            raise ValidationError(_('The end date should be in the future'))

    @api.model
    def _get_recurring_fields_to_copy(self):
        return ['company_id', 'description', 'patient_id', 'product_id', 'recurrence_id',
                'price_unit', 'physician_id', 'diseas_id', 'treatment_id', 'department_id',
                'name', 'recurring_procedure', 'consumable_line_ids']

    @api.model
    def _get_recurring_fields_to_postpone(self):
        return [
            'date',
        ]

    def _get_last_procedure_id_per_recurrence_id(self):
        return {} if not self else {
            recurrence.id: max_procedure_id
            for recurrence, max_procedure_id in self.env['acs.patient.procedure'].sudo()._read_group(
                [('recurrence_id', 'in', self.ids)],
                ['recurrence_id'],
                ['id:max'],
            )
        }

    def _get_recurrence_delta(self):
        return relativedelta(**{
            f"{self.repeat_unit}s": self.repeat_interval
        })

    def _create_next_occurrence(self, occurrence_from):
        self.ensure_one()
        self.env['acs.patient.procedure'].sudo().create(
            self._create_next_occurrence_values(occurrence_from)
        )

    def _create_next_occurrence_values(self, occurrence_from):
        self.ensure_one()
        fields_to_copy = occurrence_from.read(self._get_recurring_fields_to_copy()).pop()
        create_values = {
            field: value[0] if isinstance(value, tuple) else value
            for field, value in fields_to_copy.items()
        }

        fields_to_postpone = occurrence_from.read(self._get_recurring_fields_to_postpone()).pop()
        fields_to_postpone.pop('id', None)
        create_values.update({
            field: value and value + self._get_recurrence_delta()
            for field, value in fields_to_postpone.items()
        })

        return create_values
