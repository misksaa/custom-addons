/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { deserializeDateTime } from "@web/core/l10n/dates";

/**
 * @props {models.Order} order
 * @props columns
 * @emits click-order
 */
export class PrescriptionOrderRow extends Component {
    static template = "acs_hms_pharmacy_pos.PrescriptionOrderRow";

    setup() {
        this.ui = useState(useService("ui"));
    }
    get order() {
        return this.props.order;
    }
    get highlighted() {
        const highlightedOrder = this.props.highlightedOrder;
        return !highlightedOrder
            ? false
            : highlightedOrder.backendId === this.props.order.backendId;
    }

    // Column getters //

    get name() {
        return this.order.name;
    }
    get date() {
        return deserializeDateTime(this.order.date_order).toFormat("yyyy-MM-dd HH:mm a");
    }
    get partner() {
        const partner = this.order.partner_id;
        return partner ? partner[1] : null;
    }
    get total() {
        return this.env.utils.formatCurrency(this.order.amount_total);
    }
    get state() {
        const state_mapping = {
            'draft': _t('Draft'),
            'prescription': _t('Prescribed'),
            'cancel': _t('Cancelled'),
        };
        return state_mapping[this.order.state];
    }
    get prescriptionsman() {
        const prescriptionsman = this.order.physician_id;
        return prescriptionsman ? prescriptionsman[1] : null;
    }
    get posordercount() {
        return this.order.pos_order_count;
    }
}