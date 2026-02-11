/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class SessionFormPopup extends Component {
    static template = "TreatmentSchedule.SessionFormPopup";
    static props = {
        slotData: { type: Object, optional: true },
        mode: { type: String, optional: true },
        availableProducts: { type: Array, optional: true },
        availableAppointments: { type: Array, optional: true },
        onSave: { type: Function, optional: true },
        onClose: { type: Function, optional: true },
        onDelete: { type: Function, optional: true },
    };

    setup() {
        super.setup();
        this.notification = useService("notification");

        this.state = useState({
            loading: false,

            // Form fields
            productId: null,
            productName: '',
            date: '',
            number: '',

            // Autocomplete
            productInput: '',
            showProductSuggestions: false,
            filteredProducts: [],

            // Appointments
            appointmentSearch: '',
            filteredAppointments: [],
            selectedAppointments: [],

            // Validation
            errors: {},
        });

        console.log('[SessionFormPopup] Setup with props:', this.props);

        onMounted(() => {
            this.initializeForm();
        });
    }

    initializeForm() {
        console.log('[SessionFormPopup] Initializing form...');

        const slotData = this.props.slotData;
        if (!slotData) {
            console.warn('[SessionFormPopup] No slot data provided');
            return;
        }

        if (slotData.isNewLine) {
            this.state.productId = null;
            this.state.productName = '';
            this.state.productInput = '';
            this.state.date = '';
            this.state.number = '';
        } else {
            this.state.productId = slotData.productId;
            this.state.productName = slotData.productName;
            this.state.productInput = slotData.productName;
            this.state.date = slotData.currentDate || '';
            this.state.number = slotData.currentNumber || '';

            // Initialize appointments
            if (slotData.appointments) {
                this.state.selectedAppointments = slotData.appointments.map(a => a.id) || [];
            }
        }

        // Initialize appointments list
        this.state.filteredAppointments = this.props.availableAppointments || [];

        console.log('[SessionFormPopup] Form initialized:', this.state);
    }

    onProductInputChange(event) {
        const value = event.target.value;
        this.state.productInput = value;

        if (value.length >= 1) {
            this.filterProducts(value);
            this.state.showProductSuggestions = true;
        } else {
            this.state.showProductSuggestions = false;
            this.state.filteredProducts = [];
        }
    }

    filterProducts(searchTerm) {
        const products = this.props.availableProducts || [];
        const term = searchTerm.toLowerCase();

        this.state.filteredProducts = products.filter(p =>
            p.name.toLowerCase().includes(term)
        ).slice(0, 10);

        console.log('[SessionFormPopup] Filtered products:', this.state.filteredProducts.length);
    }

    onProductSelect(product) {
        console.log('[SessionFormPopup] Product selected:', product);

        this.state.productId = product.id;
        this.state.productName = product.name;
        this.state.productInput = product.name;
        this.state.showProductSuggestions = false;
        this.state.filteredProducts = [];

        if (this.state.errors.product) {
            delete this.state.errors.product;
        }
    }

    onProductInputBlur() {
        setTimeout(() => {
            this.state.showProductSuggestions = false;
        }, 200);
    }

    onDateChange(event) {
        this.state.date = event.target.value;
        if (this.state.errors.date) {
            delete this.state.errors.date;
        }
    }

    onNumberChange(event) {
        this.state.number = event.target.value;
    }

    // Appointments methods
    onAppointmentSearchChange(event) {
        const value = event.target.value;
        this.state.appointmentSearch = value;

        if (value.length >= 2) {
            this.filterAppointments(value);
        } else {
            this.state.filteredAppointments = this.props.availableAppointments || [];
        }
    }

    filterAppointments(searchTerm) {
        const appointments = this.props.availableAppointments || [];
        const term = searchTerm.toLowerCase();

        this.state.filteredAppointments = appointments.filter(app =>
            app.name.toLowerCase().includes(term) ||
            app.patient_name.toLowerCase().includes(term) ||
            (app.physician_name && app.physician_name.toLowerCase().includes(term))
        ).slice(0, 20);
    }

    onAppointmentSelect(appointmentId) {
        console.log('[SessionFormPopup] Appointment selected:', appointmentId);

        const index = this.state.selectedAppointments.indexOf(appointmentId);
        if (index === -1) {
            // Add appointment
            this.state.selectedAppointments.push(appointmentId);
            console.log('Appointment added to selection');
        } else {
            // Remove appointment
            this.state.selectedAppointments.splice(index, 1);
            console.log('Appointment removed from selection');
        }

        console.log('Current selected appointments:', this.state.selectedAppointments);
    }

    isAppointmentSelected(appointmentId) {
        return this.state.selectedAppointments.includes(appointmentId);
    }

    validateForm() {
        this.state.errors = {};

        const slotData = this.props.slotData;

        if (slotData?.isNewLine) {
            if (!this.state.productId) {
                this.state.errors.product = 'Please select a session type';
            }
        }

        return Object.keys(this.state.errors).length === 0;
    }

    onSave() {
        console.log('[SessionFormPopup] Saving...');

        if (!this.validateForm()) {
            this.notification.add('Please fix the errors', { type: 'warning' });
            return;
        }

        const slotData = this.props.slotData;

        const saveData = {
            isNewLine: slotData?.isNewLine || false,
            lineId: slotData?.lineId,
            productId: this.state.productId,
            productName: this.state.productName,
            weekNumber: slotData?.weekNumber,
            weekKey: slotData?.weekKey,
            date: this.state.date,
            number: this.state.number,
            selectedAppointments: this.state.selectedAppointments,
        };

        console.log('[SessionFormPopup] Save data:', saveData);

        if (this.props.onSave) {
            this.props.onSave(saveData);
        }
    }

    onClose() {
        console.log('[SessionFormPopup] Closing...');
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    onDelete() {
        console.log('[SessionFormPopup] Deleting...');

        const slotData = this.props.slotData;
        if (slotData?.lineId && this.props.onDelete) {
            this.props.onDelete(slotData.lineId);
        }

        this.onClose();
    }

    getTitle() {
        const slotData = this.props.slotData;
        if (slotData?.isNewLine) {
            return 'Add Session Type';
        }
        return `Edit ${slotData?.productName || 'Session'} - ${slotData?.weekKey || ''}`;
    }

    isNewLine() {
        return this.props.slotData?.isNewLine || false;
    }

    showWeekFields() {
        return !this.isNewLine() && this.props.slotData?.weekNumber;
    }

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    }
}