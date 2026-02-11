/** @odoo-module */
 
import { registry } from "@web/core/registry";
import { EventBus } from "@odoo/owl";

class PrescriptionOrderFetcher extends EventBus {
    static serviceDependencies = ["orm", "pos"];
    constructor({ orm, pos }) {
        super();
        this.currentPage = 1;
        this.ordersToShow = [];
        this.totalCount = 0;
        this.orm = orm;
        this.pos = pos;
    }

    /**
     * for nPerPage = 10
     * +--------+----------+
     * | nItems | lastPage |
     * +--------+----------+
     * |     2  |       1  |
     * |    10  |       1  |
     * |    11  |       2  |
     * |    30  |       3  |
     * |    35  |       4  |
     * +--------+----------+
     */
    get lastPage() {
        const nItems = this.totalCount;
        return Math.trunc(nItems / (this.nPerPage + 1)) + 1;
    }
    /**
     * Calling this methods populates the `ordersToShow` then trigger `update` event.
     * @related get
     *
     * NOTE: This is tightly-coupled with pagination. So if the current page contains all
     * active orders, it will not fetch anything from the server but only sets `ordersToShow`
     * to the active orders that fits the current page.
     */
    async fetch() {
        // Show orders from the backend.
        const offset = this.nPerPage + (this.currentPage - 1 - 1) * this.nPerPage;
        const limit = this.nPerPage;
        this.ordersToShow = await this._fetch(limit, offset);

        this.trigger("update");
    }
    /**
     * This returns the orders from the backend that needs to be shown.
     * If the order is already in cache, the full information about that
     * order is not fetched anymore, instead, we use info from cache.
     *
     * @param {number} limit
     * @param {number} offset
     */
    async _fetch(limit, offset) {
        const prescription_orders = await this._getOrderIdsForCurrentPage(limit, offset);

        this.totalCount = prescription_orders.length;
        return prescription_orders;
    }
    async _getOrderIdsForCurrentPage(limit, offset) {
        const domain = [["currency_id", "=", this.pos.currency.id]].concat(
            this.searchDomain || []
        );
        this.pos.set_synch("connecting");
        const prescriptionOrders = await this.orm.searchRead(
            "prescription.order",
            domain,
            [
                "name",
                "patient_id",
                "amount_total",
                "prescription_date",
                "state",
                "physician_id",
                "pos_order_count",
                "acs_pos_processed",
            ],
            { offset, limit }
        );

        this.pos.set_synch("connected");
        return prescriptionOrders;
    }

    nextPage() {
        if (this.currentPage < this.lastPage) {
            this.currentPage += 1;
            this.fetch();
        }
    }
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
            this.fetch();
        }
    }

    /**
     * @param {integer|undefined} id id of the cached order
     * @returns {Array<models.Order>}
     */
    get(id) {
        return this.ordersToShow;
    }
    setSearchDomain(searchDomain) {
        this.searchDomain = searchDomain;
    }
    setNPerPage(val) {
        this.nPerPage = val;
    }
    setPage(page) {
        this.currentPage = page;
    }
}


export const prescriptionOrderFetcherService = {
    dependencies: PrescriptionOrderFetcher.serviceDependencies,
    start(env, deps) {
        return new PrescriptionOrderFetcher(deps);
    },
};

registry.category("services").add("prescription_order_fetcher", prescriptionOrderFetcherService);
