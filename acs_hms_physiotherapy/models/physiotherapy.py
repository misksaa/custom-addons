# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from dateutil.relativedelta import relativedelta
from datetime import datetime,date
from odoo.exceptions import UserError


class ACSPhysiotherapyExercise(models.Model):
    _name = "physiotherapy.exercise"
    _description = "Exercise Of Physiotherapy"
    
    name = fields.Char('Exercise Name')
    exercise_group_id = fields.Many2one('physiotherapy.exercise.group','Exercise group')


class ACSPhysiotherapyExerciseGroup(models.Model):
    _name = "physiotherapy.exercise.group"
    _description = "Exercise group Of Physiotherapy"

    name = fields.Char(string='Name', required=True, help="Exercise Group Name like Knee,Ankle...")
    description = fields.Text(string='Description')
    product_id = fields.Many2one('product.product',string='Service', required=True)
    exercise_ids = fields.One2many('physiotherapy.exercise','exercise_group_id',string='Exercise')

    _sql_constraints = [('code_uniq', 'unique (name)', 'Physiotherapy Group Name must be unique')]


class ACSPhysiotherapyExerciseGroupLines(models.Model):
    _name = "physiotherapy.exercise.group.lines"
    _description = "Physiotherapy Exercise Group Lines"
    
    group_id = fields.Many2one('physiotherapy.exercise.group','Exercise group')
    physiotherapy_id = fields.Many2one('acs.physiotherapy','Physiotherapy')
    exercise_ids = fields.Many2many('physiotherapy.exercise','rel_exercise_group_exercise_line','exercise_id','exercise_group_id',string='Exercise')
    price = fields.Float(related='group_id.product_id.list_price', string='Price',store=True)

    @api.onchange('group_id')
    def onchange_group_id(self):
        self.exercise_ids = self.group_id.exercise_ids

#master Template data
class ACSPhysiotherapyNoteTemplate(models.Model):
    _name = "acs.physiotherapy.note.template"
    _description = "Physiotherapy Note"

    name = fields.Char("Name")
    right_val = fields.Char("Strength Right")
    left_val = fields.Char("Strength Left")
    sensory_val = fields.Char("Sensory")
    note_type = fields.Selection([('lower','Lower'),('upper','Upper'),('hand','Hand')],string="Note Type",required=True)


class ACSPhysiotherapyNote(models.Model):
    _name = "acs.physiotherapy.note"
    _description = "Physiotherapy Note"
    # _order = sequence

    # sequence = fields.Integer(string="Sequence",default=10)
    name = fields.Char("Name")
    right_val = fields.Char("Strength Right")
    left_val = fields.Char("Strength Left")
    sensory_val = fields.Char("Sensory")
    note_type = fields.Selection([('lower','Lower'),('upper','Upper'),('hand','Hand')],string="Note Type",required=True)
    hand_data_id = fields.Many2one('acs.physiotherapy','Note')
    lower_data_id = fields.Many2one('acs.physiotherapy','Lower Note')
    upper_data_id = fields.Many2one('acs.physiotherapy','Upper Note')


#master Template data
class ACSPhysiotherapySelectionNoteTemplate(models.Model):
    _name = "acs.physiotherapy.selection.note.template"
    _description = "Physiotherapy Selection Note"
    # _order = sequence

    # sequence = fields.Integer(string="Sequence",default=10)
    name = fields.Char("Reflexes")
    right_val = fields.Selection([('normal', 'Normal'),('other', 'Other'),('positive', 'Positive'),('negative', 'Negative')],string="STRENGTH RIGHT",default='normal')
    left_val = fields.Selection([('normal', 'Normal'),('other', 'Other'),('positive', 'Positive'),('negative', 'Negative')],string="STRENGTH LEFT",default='normal')
    selnote_type = fields.Selection([('lower','Lower'),('upper','Upper'),('hand','Hand')],string="Note Type")


#master Template data
class ACSPhysiotherapySelectionNote(models.Model):
    _name = "acs.physiotherapy.selection.note"
    _description = "Physiotherapy Selection Note"
    # _order = sequence

    # sequence = fields.Integer(string="Sequence",default=10)
    name = fields.Char("Reflexes")
    right_val = fields.Selection([('normal', 'Normal'),('other', 'Other'),('positive', 'Positive'),('negative', 'Negative')],string="STRENGTH RIGHT",default='normal')
    left_val = fields.Selection([('normal', 'Normal'),('other', 'Other'),('positive', 'Positive'),('negative', 'Negative')],string="STRENGTH LEFT",default='normal')
    selnote_type = fields.Selection([('lower','Lower'),('upper','Upper'),('hand','Hand')],string="Note Type")
    lower_selectdata_id = fields.Many2one('acs.physiotherapy','Lower SNote')
    upper_selectdata_id = fields.Many2one('acs.physiotherapy','Upper SNote')


class ACSPhysiotherapy(models.Model):
    _name = "acs.physiotherapy"
    _description = "Physiotherapy"
    _inherit = ['acs.hms.mixin']

    def _get_years_sex(self):
        for rec in self:
            age = ''
            if rec.patient_id.birthday:
                b_date = rec.patient_id.birthday
                delta = relativedelta(datetime.now(), b_date)
                age = _("%s year / %s") % (delta.years, 'Male' if rec.patient_id.gender=='male' else 'Female')
            rec.years_sex = age

    @api.depends('patient_id')
    def _get_prescription_history(self):
        for rec in self:
            history = "<table class='table table-condensed'>"
            for prescription in self.env['prescription.order'].search([('patient_id', '=', rec.patient_id.id)], limit=10):
                history += _("<tr><td><b>Date:</b></td><td>%s</td></tr>")%(prescription.appointment_id.date)
                history += _("<tr><td><b>Diagnosis:</b></td><td>%s</td></tr>")%(', '.join(map(lambda x: (x.name), prescription.appointment_id.diseases_ids)))
                history += _("<tr><td><b>Medicine:</b></td>")
                history += _("<td><table class='table table-condensed'>")
                for line in prescription.prescription_line_ids:
                    history += _("<tr><td>%s</td><td>%s</td><td>%s</td></tr>")%(line.product_id.name, line.common_dosage_id.code, line.quantity)
                history += _("</table></td></tr>")
                history += _("<tr><td style='border-bottom: 1px solid black'><b>Findings:</b></td><td style='border-bottom: 1px solid black'>%s</td></tr>")%(prescription.appointment_id.notes or '')
            rec.past_history = history
    
    @api.depends('patient_id')
    def _get_physiotherapy_history(self):
        for rec in self:
            history = "<table style='border-bottom: 1px solid black' class='table table-condensed'>"
            for line in self.search([('patient_id', '=', rec.patient_id.id)],order='date desc', limit=10):
                history += _("<tr><td><b>Date:</b></td><td>%s</td></tr>")%(line.date)
                history += _("<tr><td><b>Exercise:</b></td>")
                history += _("<td><table class='table table-condensed'>")
                history += _("<strong><th>Group Name</th> <th>Price</th> <th>Exercise</th></strong>")
                for line in line.grp_exercise_ids:
                    history += _("<tr><td>%s</td><td>%s</td><td>%s</td></tr>")%(line.group_id.name, line.price, ','.join([ex.name for ex in line.exercise_ids]))
                history += _("</table></td></tr>")
            rec.physiotherapy_history = history

    @api.depends('patient_id')
    def _get_rec_total(self):
        for rec in self:
            rec.visit_count = self.search_count([('patient_id', '=', rec.patient_id.id)])

    name = fields.Char('Name', readonly=True)
    patient_id = fields.Many2one('hms.patient', string='Patient',required=True, index=True,
        help='Patient Name')
    years_sex = fields.Char(compute="_get_years_sex", string='Age / Sex')
    code =  fields.Char(related='patient_id.code', string='Reg. No.', readonly=True)
    image_128 = fields.Binary(related='patient_id.image_128',string='Image', readonly=True)
    age =  fields.Char(related='patient_id.age', string='Age', readonly=True)
    date = fields.Datetime(string='Physiotherapy Date', default=fields.Datetime.now) 
    grp_exercise_ids = fields.One2many('physiotherapy.exercise.group.lines','physiotherapy_id',
        string='Exercise group')
    invoice_exempt =  fields.Boolean(string="Invoice Exempt")
    state = fields.Selection([('draft', 'Draft'), 
        ('accepted', 'Accepted'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
        ('cancel', 'Cancel'),
        ('to_invoice', 'To Invoice'),], string='Status', readonly=True, default='draft')
    invoice_id = fields.Many2one('account.move', string='Invoice', copy=False)
    visit_count = fields.Integer(compute="_get_rec_total", store=True, string='Past Visit', readonly=True)
    gender = fields.Selection(related="patient_id.gender", string="Gender", readonly=True)
    age = fields.Char(related="patient_id.age", string='Age', readonly=True)

    past_history = fields.Html(compute='_get_prescription_history', store=True, string='Prescription History', readonly=True)
    physiotherapy_history = fields.Html(compute='_get_physiotherapy_history', store=True, string='Physiotherapy History', readonly=True)
    physiotherapist_id = fields.Many2one('res.users', string='Physiotherapist')

    # Physiotherapy Orientation note
    date_orientation = fields.Datetime(string='Orientation Date & Time', default=fields.Datetime.now)
    by_orientation = fields.Char(string="By")
    interested =  fields.Selection([('yes', 'Yes'),('no', 'No')],string="Interested",default='yes')
    interested_side = fields.Selection([('left', 'Lt'),('right', 'Rt'),('bilat','Bilat')],string="Side",default='right')
    joint_type = fields.Selection([('all_poly', 'All Poly')],string="Joint Type",default='all_poly')
    when_orientation = fields.Char(string="When")
    problem_areas = fields.Char(string="Problem Areas")
    diagnosed_first = fields.Selection([('yes', 'Yes'),('no', 'No')],string="Diagnosed First",default='yes')

    # Physiotherapy note
    date_lower_limb = fields.Datetime(string='Lower Limb Date & Time', default=fields.Datetime.now)
    date_upper_limb = fields.Datetime(string='Upper Limb Date & Time', default=fields.Datetime.now)
    date_hand = fields.Datetime(string='Hand Date & Time', default=fields.Datetime.now)
    
    hand_data_ids =  fields.One2many('acs.physiotherapy.note','hand_data_id',string='Hand Note')
    lower_data_ids =  fields.One2many('acs.physiotherapy.note','lower_data_id',string='Lower Note')
    upper_data_ids =  fields.One2many('acs.physiotherapy.note','upper_data_id',string='Upper Note')
    lower_seldata_ids =  fields.One2many('acs.physiotherapy.selection.note','lower_selectdata_id',string='Lower Selection Note')
    upper_seldata_ids =  fields.One2many('acs.physiotherapy.selection.note','upper_selectdata_id',string='Upper Selection Note')

    appointment_id = fields.Many2one('hms.appointment', 'Appointment')
    notes = fields.Text(string="Notes")
    company_id = fields.Many2one('res.company', ondelete='restrict', 
        string='Institution', default=lambda self: self.env.company)
    physiotherapy_invoice_policy = fields.Selection(related="company_id.physiotherapy_invoice_policy")
    pricelist_id = fields.Many2one('product.pricelist', string='Pricelist', check_company=True, 
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]",
        help="If you change the pricelist, related invoice will be affected.")
    acs_show_create_invoice = fields.Boolean(compute="get_acs_show_create_invoice", string="Show Create Invoice Button")

    #ACS: Compute visiblity of create invocie button.
    def get_acs_show_create_invoice(self):
        for rec in self:
            acs_show_create_invoice = False
            if not rec.invoice_id :
                if rec.state=='to_invoice':
                    acs_show_create_invoice = True
                elif rec.physiotherapy_invoice_policy=='anytime' and not rec.invoice_exempt:
                    acs_show_create_invoice = True
                elif rec.physiotherapy_invoice_policy=='advance' and not rec.invoice_exempt:
                    acs_show_create_invoice = True
            rec.acs_show_create_invoice = acs_show_create_invoice

    def action_accept(self):
        if self.company_id.physiotherapy_invoice_policy=='advance' and not self.invoice_id:
            raise UserError(('Invoice is not created yet'))
        self.state = 'accepted'

    def action_cancel(self):
        self.state = 'cancel'

    def action_in_progress(self):
        self.state = 'in_progress'

    def action_done(self):
        if self.invoice_exempt or self.invoice_id:
            self.state = 'done'
        else:
            self.state ='to_invoice'

    def create_invoice(self):
        product_data = []
        for line in self.grp_exercise_ids:
            product_data.append({
                'name': line.group_id.product_id.name,
                'price_unit': line.price or line.group_id.product_id.list_price,
                'product_id': line.group_id.product_id,
            })

        acs_context = {}
        if self.pricelist_id:
            acs_context.update({'acs_pricelist_id': self.pricelist_id.id})
        invoice = self.with_context(acs_context).acs_create_invoice(partner=self.patient_id.partner_id, patient=self.patient_id, product_data=product_data, inv_data={'hospital_invoice_type': 'physiotherapy'})
        self.invoice_id = invoice.id
        if self.state == 'to_invoice':
            self.state = 'done'

    def view_invoice(self):
        invoices = self.mapped('invoice_id')
        action = self.acs_action_view_invoice(invoices)
        return action

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            values['name'] = self.env['ir.sequence'].next_by_code('physiotherapy.code')
        return super().create(vals_list)
        
    @api.model
    def default_get(self, fields):
        res = super(ACSPhysiotherapy, self).default_get(fields)
        vals = []
        hand_templates = self.env['acs.physiotherapy.note.template'].search([('note_type','=','hand')])
        for line in hand_templates:
            vals.append((0,0,{
                'name':line.name,
                'right_val': line.right_val,
                'left_val' : line.left_val,
                'note_type': line.note_type,
                'sensory_val': line.sensory_val
            }))
        res.update({'hand_data_ids': vals})

        vals = []
        lower_templates = self.env['acs.physiotherapy.note.template'].search([('note_type','=','lower')])
        for line in lower_templates:
            vals.append((0,0,{
                'name':line.name,
                'right_val': line.right_val,
                'left_val' : line.left_val,
                'note_type' : line.note_type,
                'sensory_val': line.sensory_val
            }))
        res.update({'lower_data_ids': vals})
        vals = []

        upper_templates = self.env['acs.physiotherapy.note.template'].search([('note_type','=','upper')])
        for line in upper_templates:
            vals.append((0,0,{
                'name':line.name,
                'right_val': line.right_val,
                'left_val' : line.left_val,
                'note_type' : line.note_type,
                'sensory_val': line.sensory_val
            }))
        res.update({'upper_data_ids': vals})

        vals = []
        lower_selection_templates = self.env['acs.physiotherapy.selection.note.template'].search([('selnote_type','=','lower')])
        for line in lower_selection_templates:
            vals.append((0,0,{
                'name':line.name,
                'right_val': line.right_val,
                'left_val' : line.left_val,
                'selnote_type': line.selnote_type
            }))
        res.update({'lower_seldata_ids': vals})

        vals = []
        upper_selection_templates = self.env['acs.physiotherapy.selection.note.template'].search([('selnote_type','=','upper')])
        for line in upper_selection_templates:
            vals.append((0,0,{
                'name':line.name,
                'right_val': line.right_val,
                'left_val' : line.left_val,
                'selnote_type': line.selnote_type
            }))
        res.update({'upper_seldata_ids': vals})

        return res
        
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: