/** @odoo-module */

import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component } from "@odoo/owl";

export class SetPrescriptionOrderButton extends Component {
    static template = "acs_hms_pharmacy_pos.SetPrescriptionOrderButton";
    setup() {
        this.pos = usePos();
    }
    async click() {
        this.pos.showScreen("PrescriptionOrderManagementScreen");
    }
}

ProductScreen.addControlButton({ component: SetPrescriptionOrderButton });