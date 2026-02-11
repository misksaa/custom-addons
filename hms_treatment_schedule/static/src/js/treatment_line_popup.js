/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

console.log("========== Treatment Line Popup Module Loading ==========");

export class TreatmentLinePopup extends Component {
    static template = "TreatmentSchedule.LinePopup";
    static props = {
        mode: { type: String, optional: true },
        lineId: { type: Number, optional: true },
        scheduleId: { type: Number, optional: true },
        weekNumber: { type: Number, optional: true },
        weekDate: { type: String, optional: true },
        weekValue: { type: String, optional: true },
        lineData: { type: Object, optional: true },
        onSave: { type: Function, optional: true },
        onClose: { type: Function, optional: true },
        onDelete: { type: Function, optional: true },
    };

    setup() {
        super.setup();
        console.log("TreatmentLinePopup: Setup");

        this.orm = useService("orm");
        this.notification = useService("notification");
        this.http = useService("http"); // Use http service instead of rpc

        this.state = useState({
            loading: false,
            mode: this.props.mode || 'create',

            // Form data
            lineId: this.props.lineId || null,
            scheduleId: this.props.scheduleId,
            productId: null,
            productName: '',

            // Search
            searchTerm: '',
            suggestions: [],
            showSuggestions: false,

            // Week data (for edit mode)
            weekNumber: this.props.weekNumber || null,
            weekDate: this.props.weekDate || '',
            weekValue: this.props.weekValue || '',
        });

        onMounted(() => {
            console.log("TreatmentLinePopup: Mounted, mode:", this.state.mode);
            if (this.state.mode === 'edit' && this.props.lineData) {
                this.loadLineData();
            }
        });
    }

    loadLineData() {
        console.log("TreatmentLinePopup: Loading line data");
        const data = this.props.lineData;
        if (data) {
            this.state.lineId = data.id;
            this.state.productId = data.product_id;
            this.state.productName = data.product_name;
        }
    }

    // ==================== Search ====================

    async onSearchChange(ev) {
        const searchTerm = ev.target.value;
        this.state.searchTerm = searchTerm;

        console.log("TreatmentLinePopup: Search term:", searchTerm);

        if (searchTerm.length >= 2) {
            try {
                const results = await this.http.post('/treatment_schedule/get_session_types', {
                    search_term: searchTerm
                });
                console.log("TreatmentLinePopup: Search results:", results.length);
                this.state.suggestions = results;
                this.state.showSuggestions = true;
            } catch (error) {
                console.error("TreatmentLinePopup: Search error:", error);
            }
        } else {
            this.state.showSuggestions = false;
            this.state.suggestions = [];
        }
    }

    onSelectProduct(product) {
        console.log("TreatmentLinePopup: Product selected:", product);
        this.state.productId = product.id;
        this.state.productName = product.name;
        this.state.searchTerm = product.name;
        this.state.showSuggestions = false;
    }

    // ==================== Week Data ====================

    onWeekDateChange(ev) {
        this.state.weekDate = ev.target.value;
        console.log("TreatmentLinePopup: Week date changed:", this.state.weekDate);
    }

    onWeekValueChange(ev) {
        this.state.weekValue = ev.target.value;
        console.log("TreatmentLinePopup: Week value changed:", this.state.weekValue);
    }

    // ==================== Actions ====================

    async onSave() {
        console.log("TreatmentLinePopup: Save clicked, mode:", this.state.mode);

        this.state.loading = true;

        try {
            if (this.state.mode === 'create') {
                await this.createLine();
            } else if (this.state.mode === 'edit') {
                await this.updateLine();
            } else if (this.state.mode === 'edit_cell') {
                await this.updateCell();
            }
        } catch (error) {
            console.error("TreatmentLinePopup: Save error:", error);
            this.notification.add('Error saving: ' + error.message, { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    async createLine() {
        console.log("TreatmentLinePopup: Creating new line");

        if (!this.state.productId) {
            this.notification.add('Please select a session type', { type: 'warning' });
            return;
        }

        const result = await this.http.post('/treatment_schedule/create_line', {
            schedule_id: this.state.scheduleId,
            product_id: this.state.productId,
            sequence: 10
        });

        if (result.error) {
            throw new Error(result.error);
        }

        console.log("TreatmentLinePopup: Line created:", result);
        this.notification.add('Session line added successfully', { type: 'success' });

        if (this.props.onSave) {
            this.props.onSave(result);
        }

        this.onClose();
    }

    async updateLine() {
        console.log("TreatmentLinePopup: Updating line");

        if (!this.state.productId) {
            this.notification.add('Please select a session type', { type: 'warning' });
            return;
        }

        const result = await this.http.post('/treatment_schedule/update_line_product', {
            line_id: this.state.lineId,
            product_id: this.state.productId
        });

        if (!result.success) {
            throw new Error('Failed to update session type');
        }

        console.log("TreatmentLinePopup: Line updated");
        this.notification.add('Session type updated', { type: 'success' });

        if (this.props.onSave) {
            this.props.onSave({
                lineId: this.state.lineId,
                productId: this.state.productId,
                productName: this.state.productName,
            });
        }

        this.onClose();
    }

    async updateCell() {
        console.log("TreatmentLinePopup: Updating cell");

        const result = await this.http.post('/treatment_schedule/update_line_week', {
            line_id: this.state.lineId,
            week_number: this.state.weekNumber,
            date_value: this.state.weekDate || false,
            number_value: this.state.weekValue || ''
        });

        if (!result.success) {
            throw new Error('Failed to update week data');
        }

        console.log("TreatmentLinePopup: Cell updated");
        this.notification.add('Week data updated', { type: 'success' });

        if (this.props.onSave) {
            this.props.onSave({
                lineId: this.state.lineId,
                weekNumber: this.state.weekNumber,
                weekDate: this.state.weekDate,
                weekValue: this.state.weekValue,
            });
        }

        this.onClose();
    }

    onClose() {
        console.log("TreatmentLinePopup: Close");
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    onDelete() {
        console.log("TreatmentLinePopup: Delete clicked");

        if (confirm('Are you sure you want to delete this session line?')) {
            if (this.props.onDelete) {
                this.props.onDelete(this.state.lineId);
            }
        }
    }

    // ==================== Helpers ====================

    getTitle() {
        if (this.state.mode === 'create') {
            return 'Add Session Type';
        } else if (this.state.mode === 'edit') {
            return 'Edit Session Type';
        } else if (this.state.mode === 'edit_cell') {
            return `Edit ${this.state.productName} - Week ${this.state.weekNumber}`;
        }
        return 'Session';
    }

    showProductField() {
        return this.state.mode === 'create' || this.state.mode === 'edit';
    }

    showWeekFields() {
        return this.state.mode === 'edit_cell';
    }

    showDeleteButton() {
        return this.state.mode === 'edit' && this.state.lineId;
    }
}

console.log("========== Treatment Line Popup Module Loaded ==========");