/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";
import { parseFloat } from "@web/views/fields/parsers";
import { useBus, useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { ControlButtonsMixin } from "@point_of_sale/app/utils/control_buttons_mixin";
import { Orderline } from "@point_of_sale/app/store/models";

import { SelectionPopup } from "@point_of_sale/app/utils/input_popups/selection_popup";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { ConfirmPopup } from "@point_of_sale/app/utils/confirm_popup/confirm_popup";
import { NumberPopup } from "@point_of_sale/app/utils/input_popups/number_popup";

import { PrescriptionOrderList } from "@acs_hms_pharmacy_pos/app/order_management_screen/prescription_order_list/prescription_order_list";
import { PrescriptionOrderManagementControlPanel } from "@acs_hms_pharmacy_pos/app/order_management_screen/prescription_order_management_control_panel/prescription_order_management_control_panel";
import { Component, onMounted, useRef } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";

/**
 * ID getter to take into account falsy many2one value.
 * @param {[id: number, display_name: string] | false} fieldVal many2one field value
 * @returns {number | false}
 */
function getId(fieldVal) {
    return fieldVal && fieldVal[0];
}

export class PrescriptionOrderManagementScreen extends ControlButtonsMixin(Component) {
    static storeOnOrder = false;
    static components = { PrescriptionOrderList, PrescriptionOrderManagementControlPanel };
    static template = "acs_hms_pharmacy_pos.PrescriptionOrderManagementScreen";

    setup() {
        super.setup();
        this.pos = usePos();
        this.popup = useService("popup");
        this.orm = useService("orm");
        this.root = useRef("root");
        this.numberBuffer = useService("number_buffer");
        this.prescriptionOrderFetcher = useService("prescription_order_fetcher");
        this.notification = useService("pos_notification");

        useBus(this.prescriptionOrderFetcher, "update", this.render);

        onMounted(this.onMounted);
    }

    onMounted() {
        // calculate how many can fit in the screen.
        // It is based on the height of the header element.
        // So the result is only accurate if each row is just single line.
        const flexContainer = this.root.el.querySelector(".flex-container");
        const cpEl = this.root.el.querySelector(".control-panel");
        const headerEl = this.root.el.querySelector(".header-row");
        const val = Math.trunc(
            (flexContainer.offsetHeight - cpEl.offsetHeight - headerEl.offsetHeight) /
                headerEl.offsetHeight
        );
        this.prescriptionOrderFetcher.setNPerPage(val);
        this.prescriptionOrderFetcher.fetch();
    }

    _getPrescriptionOrderOrigin(order) {
        for (const line of order.get_orderlines()) {
            if (line.prescription_order_origin_id) {
                return line.prescription_order_origin_id;
            }
        }
        return false;
    }
    get selectedPartner() {
        const order = this.pos.orderManagement.selectedOrder;
        return order ? order.get_partner() : null;
    }
    get orders() {
        return this.prescriptionOrderFetcher.get();
    }
    async _setNumpadMode(event) {
        const { mode } = event.detail;
        this.numpadMode = mode;
        this.numberBuffer.reset();
    }
    onNextPage() {
        this.prescriptionOrderFetcher.nextPage();
    }
    onPrevPage() {
        this.prescriptionOrderFetcher.prevPage();
    }
    onSearch(domain) {
        this.prescriptionOrderFetcher.setSearchDomain(domain);
        this.prescriptionOrderFetcher.setPage(1);
        this.prescriptionOrderFetcher.fetch();
    }

    async onClickPrescriptionOrder(clickedOrder) {
        const { confirmed, payload: selectedOption } = await this.popup.add(SelectionPopup, {
            title: _t("What do you want to do?"),
            list: [
                { id: "0", label: _t("Settle the order"), item: "settle" },
            ],
        });

        if (confirmed) {
            let currentPOSOrder = this.pos.get_order();
            const prescription_order = await this._getPrescriptionOrder(clickedOrder.id);
            //clickedOrder.shipping_date = this.pos.config.ship_later && prescription_order.shipping_date;

            const currentPrescriptionOrigin = this._getPrescriptionOrderOrigin(currentPOSOrder);
            const currentPrescriptionOriginId = currentPrescriptionOrigin && currentPrescriptionOrigin.id;

            if (currentPrescriptionOriginId) {
                const linkedSO = await this._getPrescriptionOrder(currentPrescriptionOriginId);
                if (
                    getId(linkedSO.partner_id) !== getId(prescription_order.partner_id)
                ) {
                    currentPOSOrder = this.pos.add_new_order();
                    this.notification.add(_t("A new order has been created."), 4000);
                }
            }

            try {
                await this.pos.load_new_partners();
            } catch {
                // FIXME Universal catch seems ill advised
            }
            const order_partner = this.pos.db.get_partner_by_id(prescription_order.partner_id[0]);
            if (order_partner) {
                currentPOSOrder.set_partner(order_partner);
            } else {
                try {
                    await this.pos._loadPartners([prescription_order.partner_id[0]]);
                } catch {
                    const title = _t("Customer loading error");
                    const body = _t(
                        "There was a problem in loading the %s customer.",
                        prescription_order.partner_id[1]
                    );
                    await this.popup.add(ErrorPopup, { title, body });
                }
                currentPOSOrder.set_partner(
                    this.pos.db.get_partner_by_id(prescription_order.partner_id[0])
                );
            }
            const orderFiscalPos = prescription_order.fiscal_position_id
                ? this.pos.fiscal_positions.find(
                      (position) => position.id === prescription_order.fiscal_position_id[0]
                  )
                : false;
            if (orderFiscalPos) {
                currentPOSOrder.fiscal_position = orderFiscalPos;
            }
            const orderPricelist = prescription_order.pricelist_id
                ? this.pos.pricelists.find(
                      (pricelist) => pricelist.id === prescription_order.pricelist_id[0]
                  )
                : false;
            if (orderPricelist) {
                currentPOSOrder.set_pricelist(orderPricelist);
            }

            if (selectedOption == "settle") {
                // settle the order
                const lines = prescription_order.prescription_line_ids;
                const product_to_add_in_pos = lines
                    .filter((line) => !this.pos.db.get_product_by_id(line.product_id[0]))
                    .map((line) => line.product_id[0]);
                if (product_to_add_in_pos.length) {
                    const { confirmed } = await this.popup.add(ConfirmPopup, {
                        title: _t("Products not available in POS"),
                        body: _t(
                            "Some of the products in your Prescription Order are not available in POS, do you want to import them?"
                        ),
                        confirmText: _t("Yes"),
                        cancelText: _t("No"),
                    });
                    if (confirmed) {
                        await this.pos._addProducts(product_to_add_in_pos);
                    }
                }

                /**
                 * This variable will have 3 values, `undefined | false | true`.
                 * Initially, it is `undefined`. When looping thru each prescription.order.line,
                 * when a line comes with lots (`.lot_names`), we use these lot names
                 * as the pack lot of the generated pos.order.line. We ask the user
                 * if he wants to use the lots that come with the prescription.order.lines to
                 * be used on the corresponding pos.order.line only once. So, once the
                 * `useLoadedLots` becomes true, it will be true for the succeeding lines,
                 * and vice versa.
                 */
                let useLoadedLots;

                for (var i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!this.pos.db.get_product_by_id(line.product_id[0])) {
                        continue;
                    }

                    const new_line = new Orderline(
                        { env: this.env },
                        {
                            pos: this.pos,
                            order: this.pos.get_order(),
                            product: this.pos.db.get_product_by_id(line.product_id[0]),
                            description: line.name,
                            price: line.price_unit,
                            tax_ids: orderFiscalPos ? undefined : line.tax_id,
                            price_type: "manual",
                            prescription_order_origin_id: clickedOrder,
                            prescription_prescription_line_ids_id: line,
                            customer_note: line.customer_note,
                        }
                    );

                    if (
                        new_line.get_product().tracking !== "none" &&
                        (this.pos.picking_type.use_create_lots ||
                            this.pos.picking_type.use_existing_lots) &&
                        line.lot_names.length > 0
                    ) {
                        // Ask once when `useLoadedLots` is undefined, then reuse it's value on the succeeding lines.
                        const { confirmed } =
                            useLoadedLots === undefined
                                ? await this.popup.add(ConfirmPopup, {
                                      title: _t("SN/Lots Loading"),
                                      body: _t(
                                          "Do you want to load the SN/Lots linked to the Prescription Order?"
                                      ),
                                      confirmText: _t("Yes"),
                                      cancelText: _t("No"),
                                  })
                                : { confirmed: useLoadedLots };
                        useLoadedLots = confirmed;
                        if (useLoadedLots) {
                            new_line.setPackLotLines({
                                modifiedPackLotLines: [],
                                newPackLotLines: (line.lot_names || []).map((name) => ({
                                    lot_name: name,
                                })),
                            });
                        }
                    }
                    new_line.setQuantityFromSOL(line);
                    new_line.set_unit_price(line.price_unit);
                    new_line.set_discount(line.discount);
                    this.pos.get_order().add_orderline(new_line);
                }
            }

            this.pos.closeScreen();
        }
    }

    async _getPrescriptionOrder(id) {
        const [prescription_order] = await this.orm.read(
            "prescription.order",
            [id],
            [
                "prescription_line_ids",
                "patient_id",
                "partner_id",
                "pricelist_id",
                "fiscal_position_id",
                "amount_total",
                "amount_untaxed",
                "picking_ids",
            ]
        );

        const prescription_line_ids = await this._getSOLines(prescription_order.prescription_line_ids);
        prescription_order.prescription_line_ids = prescription_line_ids;

        // if (prescription_order.picking_ids[0]) {
        //     const [picking] = await this.orm.read(
        //         "stock.picking",
        //         [prescription_order.picking_ids[0]],
        //         ["scheduled_date"]
        //     );
        //     prescription_order.shipping_date = picking.scheduled_date;
        // }

        return prescription_order;
    }

    async _getSOLines(ids) {
        const so_lines = await this.orm.call("prescription.line", "read_converted", [ids]);
        return so_lines;
    }
}

registry.category("pos_screens").add("PrescriptionOrderManagementScreen", PrescriptionOrderManagementScreen);

