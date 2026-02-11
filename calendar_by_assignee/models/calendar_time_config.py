# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)


class CalendarTimeConfig(models.Model):
    _name = 'calendar.time.config'
    _description = 'Calendar Time Configuration'
    _rec_name = 'display_name'
    _order = 'active desc, id desc'

    display_name = fields.Char(string='Name', compute='_compute_display_name', store=True)
    start_hour = fields.Selection([
        ('0', '00'),
        ('1', '01'),
        ('2', '02'),
        ('3', '03'),
        ('4', '04'),
        ('5', '05'),
        ('6', '06'),
        ('7', '07'),
        ('8', '08'),
        ('9', '09'),
        ('10', '10'),
        ('11', '11'),
        ('12', '12'),
        ('13', '13'),
        ('14', '14'),
        ('15', '15'),
        ('16', '16'),
        ('17', '17'),
        ('18', '18'),
        ('19', '19'),
        ('20', '20'),
        ('21', '21'),
        ('22', '22'),
        ('23', '23')
    ], string='Start Hour', default='0', required=True)

    start_minute = fields.Selection([
        ('0', '00'),
        ('30', '30')
    ], string='Start Minute', default='0', required=True)

    end_hour = fields.Selection([
        ('0', '00'),
        ('1', '01'),
        ('2', '02'),
        ('3', '03'),
        ('4', '04'),
        ('5', '05'),
        ('6', '06'),
        ('7', '07'),
        ('8', '08'),
        ('9', '09'),
        ('10', '10'),
        ('11', '11'),
        ('12', '12'),
        ('13', '13'),
        ('14', '14'),
        ('15', '15'),
        ('16', '16'),
        ('17', '17'),
        ('18', '18'),
        ('19', '19'),
        ('20', '20'),
        ('21', '21'),
        ('22', '22'),
        ('23', '23')
    ], string='End Hour', default='23', required=True)

    end_minute = fields.Selection([
        ('0', '00'),
        ('30', '30')
    ], string='End Minute', default='0', required=True)

    active = fields.Boolean(string='Active', default=True)

    @api.depends('start_hour', 'start_minute', 'end_hour', 'end_minute')
    def _compute_display_name(self):
        for record in self:
            start_time = f"{record.start_hour}:{record.start_minute}"
            end_time = f"{record.end_hour}:{record.end_minute}"
            record.display_name = f"Calendar Time ({start_time} - {end_time})"

    @api.constrains('start_hour', 'start_minute', 'end_hour', 'end_minute')
    def _check_time_range(self):
        for record in self:
            # Convert to total minutes for comparison
            start_total_minutes = int(record.start_hour) * 60 + int(record.start_minute)
            end_total_minutes = int(record.end_hour) * 60 + int(record.end_minute)

            if start_total_minutes >= end_total_minutes:
                raise ValidationError(_("Start time must be before end time"))

            # Minimum range check (at least 30 minutes)
            if (end_total_minutes - start_total_minutes) < 30:
                raise ValidationError(_("Time range must be at least 30 minutes"))

    @api.constrains('active')
    def _check_active_config(self):
        """Ensure only one active configuration exists"""
        active_configs = self.search([('active', '=', True)])
        if len(active_configs) > 1:
            raise ValidationError(_("Only one time configuration can be active at a time"))

    @api.model
    def create(self, vals):
        """Override create to deactivate other configs if this one is active"""
        if vals.get('active'):
            # Deactivate all other configurations
            self.search([]).write({'active': False})
        return super(CalendarTimeConfig, self).create(vals)

    def write(self, vals):
        """Override write to handle activation/deactivation"""
        if 'active' in vals and vals['active']:
            # Deactivate all other configurations
            self.search([('id', 'not in', self.ids)]).write({'active': False})
        return super(CalendarTimeConfig, self).write(vals)

    @api.model
    def get_current_config(self):
        """Get the active configuration or return defaults"""
        config = self.search([('active', '=', True)], limit=1)
        if config:
            return {
                'start_hour': int(config.start_hour),
                'start_minute': int(config.start_minute),
                'end_hour': int(config.end_hour),
                'end_minute': int(config.end_minute),
            }
        return {
            'start_hour': 0,
            'start_minute': 0,
            'end_hour': 23,
            'end_minute': 0,
        }

    def action_set_default(self):
        """Set this configuration as the active one"""
        self.ensure_one()
        # Deactivate all other configurations
        self.search([('id', '!=', self.id)]).write({'active': False})
        self.write({'active': True})
        return True

    @api.model
    def create_default_config(self):
        """Create default configuration if none exists"""
        if not self.search([], limit=1):
            return self.create({
                'start_hour': '0',
                'start_minute': '0',
                'end_hour': '23',
                'end_minute': '0',
                'active': True,
            })
        return False