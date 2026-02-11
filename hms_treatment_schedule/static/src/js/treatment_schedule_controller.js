/** @odoo-module **/
import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SessionFormPopup } from "./session_form_popup";

export class TreatmentScheduleController extends Component {
    static template = "TreatmentSchedule.MainView";
    static components = {
        SessionFormPopup,
    };

    static props = {
        action: { type: Object, optional: true },
        actionId: { type: String, optional: true },
        className: { type: String, optional: true },
        updateActionState: { type: Function, optional: true },
    };

    setup() {
        super.setup();
        this.orm = useService("orm");
        this.http = useService("http");
        this.notification = useService("notification");
        this.actionService = useService("action");

        // Initialize state
        this.state = useState({
            loading: true,
            scheduleId: null,
            scheduleData: {},
            sessionTypes: [],
            weeks: [],

            // Form popup state
            showSessionPopup: false,
            popupMode: 'create',
            currentLineId: null,
            currentWeek: null,
            slotData: null,

            // Available data
            availableProducts: [],
            availablePhysicians: [],
            availableAppointments: [],

            // Edit mode for fields
            editingField: null,
            tempFieldValue: '',

            // Physician autocomplete
            physicianInput: '',
            showPhysicianSuggestions: false,
            filteredPhysicians: [],
            selectedPhysicianId: null,
            selectedPhysicianName: '',

            // Hover state for cards
            hoveredCard: null,
            hoverPosition: { x: 0, y: 0 },

            // Inline search state for add session
            showInlineSearch: false,
            inlineSearchTerm: '',
            inlineSearchSuggestions: [],
            inlineSearchTimeout: null,
        });

        console.log('====== TREATMENT SCHEDULE CONTROLLER SETUP ======');
        console.log('Props received:', this.props);

        onWillStart(async () => {
            console.log('====== onWillStart START ======');
            await this.initializeData();
            console.log('====== onWillStart END ======');
        });

        onMounted(() => {
            console.log('====== Component mounted ======');
            console.log('Current state:', this.state);
        });
    }

    async initializeData() {
        console.log('====== initializeData START ======');
        this.state.loading = true;

        try {
            // First, try to get schedule ID from action params
            let scheduleId = null;

            console.log('Checking schedule ID from various sources:');

            // 1. From action params
            if (this.props.action?.params?.active_id) {
                scheduleId = this.props.action.params.active_id;
                console.log('Found schedule_id in action.params.active_id:', scheduleId);
            }

            // 2. From action context (active_id)
            if (!scheduleId && this.props.action?.context?.active_id) {
                scheduleId = this.props.action.context.active_id;
                console.log('Found schedule_id in action.context.active_id:', scheduleId);
            }

            // 3. From action params directly
            if (!scheduleId && this.props.action?.params?.schedule_id) {
                scheduleId = this.props.action.params.schedule_id;
                console.log('Found schedule_id in action.params.schedule_id:', scheduleId);
            }

            // 4. Try to get from URL (fallback)
            if (!scheduleId) {
                console.log('Trying to parse schedule ID from URL...');
                const urlParams = new URLSearchParams(window.location.search);
                scheduleId = urlParams.get('schedule_id') || urlParams.get('id');
                if (scheduleId) {
                    console.log('Found schedule_id in URL:', scheduleId);
                }
            }

            console.log('Final schedule ID:', scheduleId);

            if (!scheduleId) {
                console.error('ERROR: No schedule ID could be found!');
                console.error('Available data:', {
                    action: this.props.action,
                    actionParams: this.props.action?.params,
                    actionContext: this.props.action?.context,
                    url: window.location.href
                });
                this.notification.add('No treatment schedule selected. Please open from a treatment schedule form.', {
                    type: 'danger'
                });
                this.state.loading = false;
                return;
            }

            this.state.scheduleId = parseInt(scheduleId);
            console.log('Schedule ID set to:', this.state.scheduleId);

            // Load schedule data
            await this.loadScheduleData();

            // Load available data
            await this.loadAvailableData();

            console.log('====== initializeData COMPLETE ======');
            console.log('Loaded data:', {
                scheduleData: this.state.scheduleData,
                sessionTypesCount: this.state.sessionTypes.length,
                availableProductsCount: this.state.availableProducts.length,
                availablePhysiciansCount: this.state.availablePhysicians.length,
                availableAppointmentsCount: this.state.availableAppointments.length
            });

        } catch (error) {
            console.error('ERROR in initializeData:', error);
            console.error('Error stack:', error.stack);
            this.notification.add('Error loading treatment schedule: ' + error.message, {
                type: 'danger'
            });
        } finally {
            this.state.loading = false;
            console.log('Loading state set to false');
        }
    }

    async loadScheduleData() {
        console.log('====== loadScheduleData START ======');
        console.log('Loading schedule data for ID:', this.state.scheduleId);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule ID to load data');
            return;
        }

        try {
            console.log('Calling API: /treatment_schedule/get_schedule_data');
            console.log('Using http service with schedule_id:', this.state.scheduleId);

            const response = await fetch('/treatment_schedule/get_schedule_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        schedule_id: this.state.scheduleId
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            console.log('Fetch response status:', response.status);

            if (!response.ok) {
                const text = await response.text();
                console.error('Raw error response:', text);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Extract result from JSON-RPC response
            const result = data.result || data;

            if (result.error) {
                console.error('API returned error:', result.error);
                throw new Error(result.error);
            }

            console.log('Setting schedule data...');
            this.state.scheduleData = result;
            this.state.sessionTypes = result.session_types || [];
            this.state.weeks = result.weeks_list || [];

            // Initialize physician autocomplete data
            if (result.physician_name) {
                this.state.selectedPhysicianName = result.physician_name;
                this.state.physicianInput = result.physician_name;
                this.state.selectedPhysicianId = result.physician_id;
            }

            console.log('Data set successfully:', {
                name: result.name,
                state: result.state,
                total_weeks: result.total_weeks,
                weeks_list: result.weeks_list,
                patient: result.patient_name,
                physician_id: result.physician_id,
                physician_name: result.physician_name,
                sessions: result.session_types?.length || 0,
                total_appointments: result.total_appointments || 0
            });

        } catch (error) {
            console.error('ERROR in loadScheduleData:', error);
            console.error('Error details:', error);

            this.notification.add('Error loading schedule data: ' + error.message, {
                type: 'danger'
            });
        }
        console.log('====== loadScheduleData END ======');
    }

    async loadAvailableData() {
        console.log('====== loadAvailableData START ======');

        try {
            console.log('Loading available products...');

            const response = await fetch('/treatment_schedule/get_available_products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {},
                    id: Math.floor(Math.random() * 1000)
                })
            });

            console.log('Fetch response status:', response.status);

            if (!response.ok) {
                const text = await response.text();
                console.error('Raw error response:', text);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const products = data.result || data;
            console.log('Products loaded:', products?.length || 0);

            console.log('Loading available physicians...');
            const physiciansResponse = await fetch('/treatment_schedule/get_available_physicians', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {},
                    id: Math.floor(Math.random() * 1000)
                })
            });

            if (!physiciansResponse.ok) {
                const text = await physiciansResponse.text();
                console.error('Raw error response:', text);
                throw new Error(`HTTP ${physiciansResponse.status}: ${physiciansResponse.statusText}`);
            }

            const physiciansData = await physiciansResponse.json();
            const physicians = physiciansData.result || physiciansData;
            console.log('Physicians loaded:', physicians?.length || 0);

            console.log('Loading available appointments...');
            const appointmentsResponse = await fetch('/treatment_schedule/get_available_appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        patient_id: this.state.scheduleData.patient_id
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            if (!appointmentsResponse.ok) {
                console.log('Failed to load appointments, using empty array');
                this.state.availableAppointments = [];
            } else {
                const appointmentsData = await appointmentsResponse.json();
                const appointments = appointmentsData.result || appointmentsData;
                console.log('Appointments loaded:', appointments?.length || 0);
                this.state.availableAppointments = appointments || [];
            }

            this.state.availableProducts = products || [];
            this.state.availablePhysicians = physicians || [];

            console.log('Available data set:', {
                products: this.state.availableProducts.length,
                physicians: this.state.availablePhysicians.length,
                appointments: this.state.availableAppointments.length
            });

        } catch (error) {
            console.error('ERROR in loadAvailableData:', error);
            console.error('Error details:', error);

            this.state.availableProducts = [];
            this.state.availablePhysicians = [];
            this.state.availableAppointments = [];
        }
        console.log('====== loadAvailableData END ======');
    }

    // ========== INLINE SEARCH FOR ADD SESSION ==========

    startInlineSearch() {
        console.log('====== startInlineSearch ======');
        this.state.showInlineSearch = true;
        this.state.inlineSearchTerm = '';
        this.state.inlineSearchSuggestions = [];
    }

    cancelInlineSearch() {
        console.log('====== cancelInlineSearch ======');
        this.state.showInlineSearch = false;
        this.state.inlineSearchTerm = '';
        this.state.inlineSearchSuggestions = [];

        if (this.state.inlineSearchTimeout) {
            clearTimeout(this.state.inlineSearchTimeout);
            this.state.inlineSearchTimeout = null;
        }
    }

    onInlineSearchInput(event) {
        const value = event.target.value;
        this.state.inlineSearchTerm = value;

        // Clear previous timeout
        if (this.state.inlineSearchTimeout) {
            clearTimeout(this.state.inlineSearchTimeout);
        }

        // Set new timeout for search
        this.state.inlineSearchTimeout = setTimeout(() => {
            this.filterInlineSearchSuggestions(value);
        }, 300);
    }

    filterInlineSearchSuggestions(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            this.state.inlineSearchSuggestions = [];
            return;
        }

        const term = searchTerm.toLowerCase();
        const suggestions = this.state.availableProducts.filter(p =>
            p.name.toLowerCase().includes(term)
        ).slice(0, 10);

        this.state.inlineSearchSuggestions = suggestions;
        console.log('Filtered inline search suggestions:', suggestions.length);
    }

    onInlineSearchSelect(product) {
        console.log('====== onInlineSearchSelect ======');
        console.log('Product selected:', product);

        // Create the new line
        this.createNewSessionLine(product);

        // Reset inline search
        this.cancelInlineSearch();
    }

    onInlineSearchKeyDown(event) {
        console.log('====== onInlineSearchKeyDown ======');
        console.log('Key pressed:', event.key);

        if (event.key === 'Enter') {
            event.preventDefault();
            if (this.state.inlineSearchSuggestions.length > 0) {
                this.onInlineSearchSelect(this.state.inlineSearchSuggestions[0]);
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelInlineSearch();
        }
    }

    onInlineSearchBlur() {
        // Delay to allow click on suggestion
        setTimeout(() => {
            this.cancelInlineSearch();
        }, 200);
    }

    async createNewSessionLine(product) {
        console.log('====== createNewSessionLine ======');
        console.log('Creating new line for product:', product);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule selected');
            this.notification.add('No schedule selected', { type: 'danger' });
            return;
        }

        try {
            const response = await fetch('/treatment_schedule/create_line', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        schedule_id: this.state.scheduleId,
                        product_id: product.id,
                        sequence: (this.state.sessionTypes.length + 1) * 10,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const resultData = await response.json();
            const result = resultData.result || resultData;
            console.log('Create line API response:', result);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.id) {
                console.log('New line created with ID:', result.id);
                this.state.sessionTypes.push(result);
                this.notification.add('Session type added successfully', { type: 'success' });

                // Refresh schedule data
                await this.loadScheduleData();
            }
        } catch (error) {
            console.error('ERROR in createNewSessionLine:', error);
            this.notification.add('Error adding session type: ' + error.message, { type: 'danger' });
        }
    }

    // ========== PHYSICIAN AUTOCOMPLETE ==========

    onPhysicianInputChange(event) {
        const value = event.target.value;
        this.state.physicianInput = value;
        this.state.tempFieldValue = value;

        if (value.length >= 2) {
            this.filterPhysicians(value);
            this.state.showPhysicianSuggestions = true;
        } else {
            this.state.showPhysicianSuggestions = false;
            this.state.filteredPhysicians = [];
            this.state.selectedPhysicianId = null;
            this.state.selectedPhysicianName = '';
        }
    }

    filterPhysicians(searchTerm) {
        const physicians = this.state.availablePhysicians || [];
        const term = searchTerm.toLowerCase();

        this.state.filteredPhysicians = physicians.filter(p =>
            p.name.toLowerCase().includes(term)
        ).slice(0, 10);

        console.log('[TreatmentSchedule] Filtered physicians:', this.state.filteredPhysicians.length);
    }

    onPhysicianSelect(physician) {
        console.log('[TreatmentSchedule] Physician selected:', physician);

        this.state.selectedPhysicianId = physician.id;
        this.state.selectedPhysicianName = physician.name;
        this.state.physicianInput = physician.name;
        this.state.tempFieldValue = physician.name;
        this.state.showPhysicianSuggestions = false;
        this.state.filteredPhysicians = [];
    }

    onPhysicianInputBlur() {
        setTimeout(() => {
            this.state.showPhysicianSuggestions = false;
        }, 200);
    }

    // ========== WEEKS SELECTION MANAGEMENT ==========

    getWeeksOptions() {
        return Array.from({ length: 10 }, (_, i) => ({
            value: (i + 1).toString(),
            label: `${i + 1} Week${i + 1 > 1 ? 's' : ''}`
        }));
    }

    async onWeeksChange(newValue) {
        console.log('====== onWeeksChange START ======');
        console.log('Changing total weeks to:', newValue);
        console.log('Current schedule ID:', this.state.scheduleId);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule selected');
            this.notification.add('No schedule selected', { type: 'danger' });
            return;
        }

        try {
            console.log('Calling API: /treatment_schedule/update_schedule_field');
            const response = await fetch('/treatment_schedule/update_schedule_field', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        schedule_id: this.state.scheduleId,
                        field_name: 'total_weeks',
                        value: newValue,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const data = await response.json();
            const result = data.result || data;
            console.log('API Response:', result);

            if (result.success) {
                console.log('Total weeks updated successfully');
                this.state.scheduleData.total_weeks = newValue;

                // Update weeks list
                const totalWeeks = parseInt(newValue);
                this.state.weeks = Array.from({ length: totalWeeks }, (_, i) => `WK${i + 1}`);

                this.notification.add('Total weeks updated successfully', { type: 'success' });

                // Reload schedule data to get updated session types
                setTimeout(() => {
                    this.loadScheduleData();
                }, 300);
            } else {
                console.error('API returned error:', result.error);
                this.notification.add(result.error || 'Error updating total weeks', { type: 'danger' });
            }
        } catch (error) {
            console.error('ERROR in onWeeksChange:', error);
            console.error('Error details:', error);
            this.notification.add('Error updating total weeks: ' + error.message, { type: 'danger' });
        }
        console.log('====== onWeeksChange END ======');
    }

    // ========== STATUS MANAGEMENT ==========

    getStateDisplayName(state) {
        const stateNames = {
            'draft': 'Draft',
            'in_progress': 'In Progress',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
        };
        return stateNames[state] || state;
    }

    getStateColor(state) {
        const stateColors = {
            'draft': '#6c757d',
            'in_progress': '#007bff',
            'completed': '#28a745',
            'cancelled': '#dc3545',
        };
        return stateColors[state] || '#607D8B';
    }

    getStateStyle(state) {
        const color = this.getStateColor(state);
        return `background-color: ${color}; color: white;`;
    }

    async onStateChange(newState) {
        console.log('====== onStateChange START ======');
        console.log('Changing state to:', newState);
        console.log('Current schedule ID:', this.state.scheduleId);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule selected');
            this.notification.add('No schedule selected', { type: 'danger' });
            return;
        }

        try {
            console.log('Calling API: /treatment_schedule/update_state');
            const response = await fetch('/treatment_schedule/update_state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        schedule_id: this.state.scheduleId,
                        new_state: newState,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const data = await response.json();
            const result = data.result || data;
            console.log('API Response:', result);

            if (result.success) {
                console.log('State update successful');
                this.state.scheduleData.state = newState;
                this.notification.add('Status updated successfully', { type: 'success' });
                console.log('Local state updated to:', newState);
            } else {
                console.error('API returned error:', result.error);
                this.notification.add(result.error || 'Error updating status', { type: 'danger' });
            }
        } catch (error) {
            console.error('ERROR in onStateChange:', error);
            console.error('Error details:', error);
            this.notification.add('Error updating status: ' + error.message, { type: 'danger' });
        }
        console.log('====== onStateChange END ======');
    }

    // ========== PRINT ==========

    async onPrintReport() {
        console.log('====== onPrintReport START ======');
        console.log('Printing report for schedule:', this.state.scheduleId);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule selected');
            this.notification.add('No schedule selected', { type: 'danger' });
            return;
        }

        try {
            console.log('Calling API: /treatment_schedule/print_report');
            const response = await fetch('/treatment_schedule/print_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        schedule_id: this.state.scheduleId,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const data = await response.json();
            const result = data.result || data;
            console.log('API Response:', result);

            if (result.success) {
                console.log('Report URL:', result.url);
                window.open(result.url, '_blank');
                this.notification.add('Report opened in new tab', { type: 'success' });
            } else {
                console.error('API returned error:', result.error);
                this.notification.add(result.error || 'Error generating report', { type: 'danger' });
            }
        } catch (error) {
            console.error('ERROR in onPrintReport:', error);
            console.error('Error details:', error);
            this.notification.add('Error generating report: ' + error.message, { type: 'danger' });
        }
        console.log('====== onPrintReport END ======');
    }

    // ========== FIELD EDITING ==========

    onFieldEdit(fieldName) {
        console.log('====== onFieldEdit ======');
        console.log('Editing field:', fieldName);
        console.log('Current schedule data:', this.state.scheduleData);

        this.state.editingField = fieldName;

        if (fieldName === 'physician') {
            this.state.physicianInput = this.state.scheduleData.physician_name || '';
            this.state.tempFieldValue = this.state.scheduleData.physician_name || '';
            this.state.selectedPhysicianId = this.state.scheduleData.physician_id || null;
            this.state.selectedPhysicianName = this.state.scheduleData.physician_name || '';
            this.state.showPhysicianSuggestions = false;
            this.state.filteredPhysicians = [];

            console.log('Physician field - current name:', this.state.tempFieldValue);
        } else if (fieldName === 'total_weeks') {
            this.state.tempFieldValue = this.state.scheduleData.total_weeks || '1';
            console.log('Total weeks field - current value:', this.state.tempFieldValue);
        } else {
            this.state.tempFieldValue = this.state.scheduleData[fieldName] || '';
            console.log('Other field - current value:', this.state.tempFieldValue);
        }
    }

    onFieldCancel() {
        console.log('====== onFieldCancel ======');
        console.log('Cancelling field edit for:', this.state.editingField);

        this.state.editingField = null;
        this.state.tempFieldValue = '';
        this.state.physicianInput = '';
        this.state.showPhysicianSuggestions = false;
        this.state.filteredPhysicians = [];
        this.state.selectedPhysicianId = null;
        this.state.selectedPhysicianName = '';
    }

    async onFieldSave(fieldName) {
        console.log('====== onFieldSave START ======');
        console.log('Saving field:', fieldName);
        console.log('New value:', this.state.tempFieldValue);
        console.log('Schedule ID:', this.state.scheduleId);
        console.log('Current schedule data:', this.state.scheduleData);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule selected');
            this.notification.add('No schedule selected', { type: 'danger' });
            return;
        }

        const fieldToSend = fieldName === 'physician' ? 'physician_id' : fieldName;
        let valueToSend;

        if (fieldName === 'physician') {
            if (this.state.selectedPhysicianId) {
                valueToSend = this.state.selectedPhysicianId;
            } else if (this.state.physicianInput && this.state.physicianInput.trim()) {
                const physician = this.state.availablePhysicians.find(p =>
                    p.name.toLowerCase() === this.state.physicianInput.toLowerCase().trim()
                );

                if (physician) {
                    valueToSend = physician.id;
                } else {
                    valueToSend = false;
                }
            } else {
                valueToSend = false;
            }
        } else {
            valueToSend = this.state.tempFieldValue;
        }

        console.log('Field to send:', fieldToSend);
        console.log('Value to send:', valueToSend);

        try {
            console.log('Calling API: /treatment_schedule/update_schedule_field');
            const response = await fetch('/treatment_schedule/update_schedule_field', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        schedule_id: this.state.scheduleId,
                        field_name: fieldToSend,
                        value: valueToSend,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const data = await response.json();
            const result = data.result || data;
            console.log('API Response:', result);

            if (result.success) {
                console.log('Field update successful');

                if (fieldName === 'physician') {
                    this.state.scheduleData.physician_name = this.state.physicianInput || '';
                    this.state.scheduleData.physician_id = valueToSend;

                    console.log('Updated physician data:', {
                        name: this.state.scheduleData.physician_name
                    });
                } else if (fieldName === 'date') {
                    this.state.scheduleData.date = valueToSend;
                    console.log('Updated date:', this.state.scheduleData.date);
                } else if (fieldName === 'total_weeks') {
                    this.state.scheduleData.total_weeks = valueToSend;
                    // Update weeks list
                    const totalWeeks = parseInt(valueToSend);
                    this.state.weeks = Array.from({ length: totalWeeks }, (_, i) => `WK${i + 1}`);
                    console.log('Updated total weeks:', this.state.scheduleData.total_weeks);
                } else {
                    this.state.scheduleData[fieldName] = valueToSend;
                    console.log(`Updated ${fieldName}:`, this.state.scheduleData[fieldName]);
                }

                this.notification.add('Field updated successfully', { type: 'success' });

                // For total weeks change, reload schedule data to get updated session types
                if (fieldName === 'total_weeks') {
                    setTimeout(() => {
                        this.loadScheduleData();
                    }, 300);
                }

            } else {
                console.error('API returned error:', result.error);
                this.notification.add(result.error || 'Error updating field', { type: 'danger' });
            }
        } catch (error) {
            console.error('ERROR in onFieldSave:', error);
            console.error('Error details:', error);
            this.notification.add('Error updating field: ' + error.message, { type: 'danger' });
        } finally {
            console.log('Resetting edit mode');
            this.state.editingField = null;
            this.state.tempFieldValue = '';
            this.state.physicianInput = '';
            this.state.showPhysicianSuggestions = false;
            this.state.filteredPhysicians = [];
            this.state.selectedPhysicianId = null;
            this.state.selectedPhysicianName = '';
        }
        console.log('====== onFieldSave END ======');
    }

    onTempFieldChange(event) {
        console.log('Field value changed:', event.target.value);
        this.state.tempFieldValue = event.target.value;
    }

    // ========== SESSION/LINE MANAGEMENT ==========

    getWeekData(sessionType, weekKey) {
        const weekNum = weekKey.replace('WK', '').toLowerCase();
        const date = sessionType[`wk${weekNum}_date`] || '';
        const number = sessionType[`wk${weekNum}_number`] || '';
        const appointmentsCount = sessionType[`wk${weekNum}_appointments_count`] || 0;
        const appointments = sessionType[`wk${weekNum}_appointments`] || [];

        return { date, number, appointmentsCount, appointments };
    }

    hasWeekData(sessionType, weekKey) {
        const data = this.getWeekData(sessionType, weekKey);
        const hasData = data.date || data.number || data.appointmentsCount > 0;
        return hasData;
    }

    getWeekCardStyle(sessionType, weekKey) {
        const hasData = this.hasWeekData(sessionType, weekKey);
        if (hasData) {
            return 'background-color: #e3f2fd; border: 2px solid #2196F3;';
        }
        return 'background-color: #f8f9fa; border: 2px dashed #dee2e6;';
    }

    onCellClick(sessionType, weekKey) {
        console.log('====== onCellClick ======');
        console.log('Cell clicked:', {
            product: sessionType.product_name,
            weekKey,
            sessionTypeId: sessionType.id
        });

        const weekNum = parseInt(weekKey.replace('WK', ''));
        const weekData = this.getWeekData(sessionType, weekKey);

        this.state.slotData = {
            lineId: sessionType.id,
            productId: sessionType.product_id,
            productName: sessionType.product_name,
            weekNumber: weekNum,
            weekKey: weekKey,
            currentDate: weekData.date,
            currentNumber: weekData.number,
            appointments: weekData.appointments,
            appointmentsCount: weekData.appointmentsCount,
        };

        this.state.currentLineId = sessionType.id;
        this.state.currentWeek = weekNum;
        this.state.popupMode = weekData.date || weekData.number || weekData.appointmentsCount > 0 ? 'edit' : 'create';
        this.state.showSessionPopup = true;

        console.log('Popup data set:', this.state.slotData);
    }

    // NEW FUNCTION: Open appointment form when clicking on appointment card
    onAppointmentClick(appointmentId) {
        console.log('====== onAppointmentClick START ======');
        console.log('Opening appointment form for ID:', appointmentId);

        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'hms.appointment',
            res_id: appointmentId,
            views: [[false, 'form']],
            target: 'current',
        });
    }

    onAddSessionType() {
        console.log('====== onAddSessionType ======');
        console.log('Adding new session type');

        this.state.slotData = {
            lineId: null,
            productId: null,
            productName: '',
            weekNumber: null,
            weekKey: null,
            currentDate: '',
            currentNumber: '',
            appointments: [],
            appointmentsCount: 0,
            isNewLine: true,
        };

        this.state.currentLineId = null;
        this.state.currentWeek = null;
        this.state.popupMode = 'create';
        this.state.showSessionPopup = true;

        console.log('Popup opened for new line');
    }

    onClosePopup() {
        console.log('====== onClosePopup ======');
        console.log('Closing popup');

        this.state.showSessionPopup = false;
        this.state.slotData = null;
        this.state.currentLineId = null;
        this.state.currentWeek = null;
    }

    async onPopupSave(data) {
        console.log('====== onPopupSave START ======');
        console.log('Saving popup data:', data);
        console.log('Schedule ID:', this.state.scheduleId);

        if (!this.state.scheduleId) {
            console.error('ERROR: No schedule selected');
            this.notification.add('No schedule selected', { type: 'danger' });
            this.onClosePopup();
            return;
        }

        this.state.loading = true;

        try {
            if (data.isNewLine) {
                console.log('Creating new line...');
                console.log('Product ID:', data.productId);
                console.log('Sequence:', (this.state.sessionTypes.length + 1) * 10);

                const response = await fetch('/treatment_schedule/create_line', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                            schedule_id: this.state.scheduleId,
                            product_id: data.productId,
                            sequence: (this.state.sessionTypes.length + 1) * 10,
                        },
                        id: Math.floor(Math.random() * 1000)
                    })
                });

                const resultData = await response.json();
                const result = resultData.result || resultData;
                console.log('Create line API response:', result);

                if (result.error) {
                    throw new Error(result.error);
                }

                if (result.id) {
                    console.log('New line created with ID:', result.id);
                    this.state.sessionTypes.push(result);
                    this.notification.add('Session type added successfully', { type: 'success' });
                }
            } else {
                console.log('Updating existing line...');
                console.log('Line ID:', data.lineId);
                console.log('Week number:', data.weekNumber);
                console.log('Date:', data.date);
                console.log('Number:', data.number);
                console.log('Selected appointments:', data.selectedAppointments);

                // First update the date and number
                const updateResponse = await fetch('/treatment_schedule/update_line_week', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                            line_id: data.lineId,
                            week_number: data.weekNumber,
                            date_value: data.date || null,
                            number_value: data.number || '',
                        },
                        id: Math.floor(Math.random() * 1000)
                    })
                });

                const updateResultData = await updateResponse.json();
                const updateResult = updateResultData.result || updateResultData;
                console.log('Update line API response:', updateResult);

                if (updateResult.success) {
                    console.log('Line update successful');

                    // Now update appointments if there are any
                    if (data.selectedAppointments && data.selectedAppointments.length >= 0) {
                        console.log('Updating appointments...');

                        // Get current appointments for this week from updated line
                        const currentAppointments = updateResult.line?.[`wk${data.weekNumber}_appointments`] || [];
                        const currentAppointmentIds = currentAppointments.map(app => app.id);

                        console.log('Current appointment IDs from updated line:', currentAppointmentIds);
                        console.log('Selected appointment IDs:', data.selectedAppointments);

                        // Find appointments to add
                        const appointmentsToAdd = data.selectedAppointments.filter(id =>
                            !currentAppointmentIds.includes(id)
                        );

                        // Find appointments to remove
                        const appointmentsToRemove = currentAppointmentIds.filter(id =>
                            !data.selectedAppointments.includes(id)
                        );

                        console.log('Appointments to add:', appointmentsToAdd);
                        console.log('Appointments to remove:', appointmentsToRemove);

                        // Add new appointments
                        for (const appointmentId of appointmentsToAdd) {
                            try {
                                console.log('Adding appointment:', appointmentId);
                                const addResponse = await fetch('/treatment_schedule/add_appointment_to_week', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        jsonrpc: '2.0',
                                        method: 'call',
                                        params: {
                                            line_id: data.lineId,
                                            week_number: data.weekNumber,
                                            appointment_id: appointmentId,
                                        },
                                        id: Math.floor(Math.random() * 1000)
                                    })
                                });

                                const addResultData = await addResponse.json();
                                const addResult = addResultData.result || addResultData;
                                console.log('Add appointment API response:', addResult);

                                if (!addResult.success) {
                                    console.warn('Warning: Failed to add appointment:', addResult.error);
                                }
                            } catch (addError) {
                                console.error('Error adding appointment:', addError);
                            }
                        }

                        // Remove old appointments
                        for (const appointmentId of appointmentsToRemove) {
                            try {
                                console.log('Removing appointment:', appointmentId);
                                const removeResponse = await fetch('/treatment_schedule/remove_appointment_from_week', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        jsonrpc: '2.0',
                                        method: 'call',
                                        params: {
                                            line_id: data.lineId,
                                            week_number: data.weekNumber,
                                            appointment_id: appointmentId,
                                        },
                                        id: Math.floor(Math.random() * 1000)
                                    })
                                });

                                const removeResultData = await removeResponse.json();
                                const removeResult = removeResultData.result || removeResultData;
                                console.log('Remove appointment API response:', removeResult);

                                if (!removeResult.success) {
                                    console.warn('Warning: Failed to remove appointment:', removeResult.error);
                                }
                            } catch (removeError) {
                                console.error('Error removing appointment:', removeError);
                            }
                        }
                    }

                    // Update local state immediately
                    const lineIndex = this.state.sessionTypes.findIndex(s => s.id === data.lineId);
                    console.log('Found line at index:', lineIndex);

                    if (lineIndex >= 0 && updateResult.line) {
                        this.state.sessionTypes[lineIndex] = updateResult.line;
                        console.log('Local state updated immediately');
                    }

                    this.notification.add('Session updated successfully', { type: 'success' });

                    // Refresh schedule data to get updated appointments
                    setTimeout(async () => {
                        console.log('Refreshing schedule data after appointment updates...');
                        await this.loadScheduleData();
                        this.notification.add('Appointments updated successfully', { type: 'success' });
                    }, 500);

                } else {
                    console.error('API returned error:', updateResult.error);
                    this.notification.add(updateResult.error || 'Error updating session', { type: 'danger' });
                }
            }
        } catch (error) {
            console.error('ERROR in onPopupSave:', error);
            console.error('Error details:', error);
            this.notification.add('Error saving session: ' + error.message, { type: 'danger' });
        } finally {
            this.state.loading = false;
            this.onClosePopup();
        }
        console.log('====== onPopupSave END ======');
    }



    async onDeleteLine(lineId) {
        console.log('====== onDeleteLine START ======');
        console.log('Deleting line:', lineId);

        if (!confirm('Are you sure you want to delete this session type?')) {
            console.log('Deletion cancelled by user');
            return;
        }

        try {
            console.log('Calling API: /treatment_schedule/delete_line');
            const response = await fetch('/treatment_schedule/delete_line', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        line_id: lineId,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const data = await response.json();
            const result = data.result || data;
            console.log('Delete line API response:', result);

            if (result.success) {
                console.log('Line deletion successful');
                this.state.sessionTypes = this.state.sessionTypes.filter(s => s.id !== lineId);
                this.notification.add('Session type deleted', { type: 'success' });
            } else {
                console.error('API returned error:', result.error);
                this.notification.add(result.error || 'Error deleting session', { type: 'danger' });
            }
        } catch (error) {
            console.error('ERROR in onDeleteLine:', error);
            console.error('Error details:', error);
            this.notification.add('Error deleting session: ' + error.message, { type: 'danger' });
        }
        console.log('====== onDeleteLine END ======');
    }

    // ========== CARD HOVER ==========

    onCardMouseEnter(event, sessionType, weekKey) {
        const rect = event.target.getBoundingClientRect();
        this.state.hoveredCard = {
            sessionType,
            weekKey,
            data: this.getWeekData(sessionType, weekKey),
        };
        this.state.hoverPosition = {
            x: rect.right + 15,
            y: rect.top,
        };
    }

    onCardMouseLeave() {
        this.state.hoveredCard = null;
    }

    // ========== NAVIGATION ==========

    onGoBack() {
        console.log('====== onGoBack ======');
        console.log('Going back to form view');
        console.log('Schedule ID for form:', this.state.scheduleId);

        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'hms.treatment.schedule',
            res_id: this.state.scheduleId,
            views: [[false, 'form']],
            target: 'current',
        });
    }

    onRefresh() {
        console.log('====== onRefresh ======');
        console.log('Refreshing data');

        this.loadScheduleData();
    }

    // ========== UTILITY ==========

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

    formatAppointmentTime(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error('Error formatting appointment time:', error);
            return dateString;
        }
    }

    getAppointmentGridClass(count) {
        if (count === 1) return 'grid-1';
        if (count === 2) return 'grid-2';
        if (count === 3) return 'grid-3';
        if (count === 4) return 'grid-4';
        if (count > 4) return 'grid-many';
        return '';
    }
}
