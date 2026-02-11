/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class BulkAppointmentPopup extends Component {
    static template = "CalendarByAssignee.BulkAppointmentPopup";
    static props = ["*"];

    setup() {
        super.setup();

        this.orm = useService("orm");
        this.notification = useService("notification");
        this.action = useService("action");

        this.state = useState({
            loading: false,
            initialLoading: true,
            saving: false,

            // Shared fields across all appointments
            patient_id: null,
            physician_id: null,
            cabin_id: null,
            appointment_state: 'draft',

            // Dropdown data
            patients: [],
            physicians: [],
            cabins: [],

            // Autocomplete states
            patient_display_name: '',
            patient_input: '',
            showPatientSuggestions: false,
            physician_display_name: '',
            physician_input: '',
            showPhysicianSuggestions: false,
            cabin_display_name: '',
            cabin_input: '',
            showCabinSuggestions: false,

            // Time dropdown states
            activeTimeDropdown: null, // Format: "sessionIndex_weekNumber_appointmentIndex_field"

            // All status options (same as original form)
            stateOptions: [
                { value: 'draft', label: 'Draft' },
                { value: 'no_answer', label: 'No Answer' },
                { value: 'call_back', label: 'Call Back' },
                { value: 'posponed', label: 'Postponed' },
                { value: 'confirm', label: 'Confirmed' },
                { value: 'booked', label: 'Booked' },
                { value: 'arrived', label: 'Arrived' },
                { value: 'waiting', label: 'Waiting' },
                { value: 'treatment', label: 'Treatment' },
                { value: 'in_consultation', label: 'In Consultation' },
                { value: 'basic_7_floor', label: 'Basic 7th Floor' },
                { value: 'pause', label: 'Paused' },
                { value: 'to_invoice', label: 'To Invoice' },
                { value: 'gig_insurance', label: 'GIG Insurance' },
                { value: 'billed', label: 'Billed' },
                { value: 'done', label: 'Done' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'blocked', label: 'Blocked' },
                { value: 'follow_up', label: 'Follow Up' },
                { value: 'feels_good', label: 'Feels Good' }
            ],

            // Treatment Schedule fields
            treatment_schedules: [],
            selected_treatment_schedule_id: null,
            selected_treatment_schedule: null,
            treatment_schedule_lines: [],
            total_weeks: 0,
            loading_treatment_schedule: false,

            // Session type selection with per-week appointment counts
            selectedSessionTypes: [],
            // Structure: [{
            //   line_id: int,
            //   product_name: string,
            //   weeks: {
            //     1: { count: 0, appointments: [{date: '', startTime: '08:00', endTime: '08:30'}] },
            //     2: { count: 0, appointments: [] },
            //     ...
            //   }
            // }]

            // Validation
            errors: {},
            appointmentErrors: {}, // For individual appointment field errors
        });

        onMounted(async () => {
            this.state.initialLoading = true;
            try {
                await this.initializeData();
            } catch (error) {
                console.error('Error loading bulk appointment form data:', error);
                this.showNotification('Error loading form data', 'danger');
            } finally {
                setTimeout(() => {
                    this.state.initialLoading = false;
                }, 300);
            }
        });
    }

    // ==================== DATA LOADING ====================

    initializeData = async () => {
        try {
            const [patients, physicians, cabins] = await Promise.all([
                this.orm.searchRead('hms.patient', [], ['id', 'name', 'mobile', 'phone', 'gender', 'age', 'code']),
                this.orm.searchRead('hms.physician', [['active', '=', true]], ['id', 'name']),
                this.orm.searchRead('appointment.cabin', [], ['id', 'name'])
            ]);

            this.state.patients = patients;
            this.state.physicians = physicians;
            this.state.cabins = cabins;
        } catch (error) {
            console.error('Error initializing data:', error);
            throw error;
        }
    }

    loadTreatmentSchedules = async () => {
        try {
            if (!this.state.patient_id) {
                this.state.treatment_schedules = [];
                return;
            }

            this.state.loading_treatment_schedule = true;

            const schedules = await this.orm.searchRead(
                'hms.treatment.schedule',
                [
                    ['patient_id', '=', this.state.patient_id],
                    ['state', 'in', ['draft', 'in_progress']]
                ],
                ['id', 'name', 'date', 'state', 'total_weeks', 'patient_id']
            );

            this.state.treatment_schedules = schedules;
        } catch (error) {
            console.error('Error loading treatment schedules:', error);
            this.showNotification('Error loading treatment schedules', 'danger');
        } finally {
            this.state.loading_treatment_schedule = false;
        }
    }

    loadTreatmentScheduleLines = async () => {
        try {
            if (!this.state.selected_treatment_schedule_id) return;

            this.state.loading_treatment_schedule = true;

            const lines = await this.orm.searchRead(
                'hms.treatment.schedule.line',
                [['schedule_id', '=', this.state.selected_treatment_schedule_id]],
                ['id', 'product_id', 'sequence'],
                { order: 'sequence' }
            );

            this.state.treatment_schedule_lines = lines;

            // Load schedule data to get total weeks
            const schedule = await this.orm.read(
                'hms.treatment.schedule',
                [this.state.selected_treatment_schedule_id],
                ['total_weeks']
            );

            if (schedule && schedule[0]) {
                this.state.total_weeks = parseInt(schedule[0].total_weeks) || 0;
            }
        } catch (error) {
            console.error('Error loading treatment schedule lines:', error);
        } finally {
            this.state.loading_treatment_schedule = false;
        }
    }

    // ==================== PATIENT AUTOCOMPLETE ====================

    handlePatientInput = (value) => {
        this.clearError('patient_id');
        this.state.patient_display_name = value;
        this.state.patient_input = value;

        if (value.length >= 2) {
            this.state.showPatientSuggestions = true;
        } else {
            this.state.showPatientSuggestions = false;
        }
    }

    handlePatientFocus = () => {
        if (this.state.patient_display_name && this.state.patient_display_name.length >= 2) {
            this.state.showPatientSuggestions = true;
        }
    }

    handlePatientBlur = () => {
        setTimeout(() => {
            this.state.showPatientSuggestions = false;
        }, 200);
    }

    getFilteredPatientSuggestions = () => {
        if (!this.state.patient_input || this.state.patient_input.length < 2) return [];

        const searchTerm = this.state.patient_input.toLowerCase();
        return this.state.patients.filter(patient => {
            const nameMatch = patient.name.toLowerCase().includes(searchTerm);
            const mobileMatch = patient.mobile && patient.mobile.includes(searchTerm);
            const phoneMatch = patient.phone && patient.phone.includes(searchTerm);
            const codeMatch = patient.code && patient.code.toLowerCase().includes(searchTerm);
            return nameMatch || mobileMatch || phoneMatch || codeMatch;
        }).slice(0, 10);
    }

    selectPatient = (patient) => {
        this.state.patient_id = patient.id;
        this.state.patient_display_name = patient.name;
        this.state.patient_input = patient.name;
        this.state.showPatientSuggestions = false;

        // Reset treatment schedule selections when patient changes
        this.state.selected_treatment_schedule_id = null;
        this.state.selected_treatment_schedule = null;
        this.state.treatment_schedule_lines = [];
        this.state.selectedSessionTypes = [];
        this.state.total_weeks = 0;

        // Load treatment schedules for this patient
        this.loadTreatmentSchedules();
    }

    // ==================== PHYSICIAN AUTOCOMPLETE ====================

    handlePhysicianInput = (value) => {
        this.clearError('physician_id');
        this.state.physician_display_name = value;
        this.state.physician_input = value;

        if (value.length >= 2) {
            this.state.showPhysicianSuggestions = true;
        } else {
            this.state.showPhysicianSuggestions = false;
        }
    }

    handlePhysicianFocus = () => {
        if (this.state.physician_display_name && this.state.physician_display_name.length >= 2) {
            this.state.showPhysicianSuggestions = true;
        }
    }

    handlePhysicianBlur = () => {
        setTimeout(() => {
            this.state.showPhysicianSuggestions = false;
        }, 200);
    }

    getFilteredPhysicianSuggestions = () => {
        if (!this.state.physician_input || this.state.physician_input.length < 2) return [];

        const searchTerm = this.state.physician_input.toLowerCase();
        return this.state.physicians.filter(physician =>
            physician.name.toLowerCase().includes(searchTerm)
        ).slice(0, 10);
    }

    selectPhysician = (physician) => {
        this.state.physician_id = physician.id;
        this.state.physician_display_name = physician.name;
        this.state.physician_input = physician.name;
        this.state.showPhysicianSuggestions = false;
    }

    // ==================== CABIN AUTOCOMPLETE ====================

    handleCabinInput = (value) => {
        this.clearError('cabin_id');
        this.state.cabin_display_name = value;
        this.state.cabin_input = value;

        if (value.length >= 2) {
            this.state.showCabinSuggestions = true;
        } else {
            this.state.showCabinSuggestions = false;
        }
    }

    handleCabinFocus = () => {
        if (this.state.cabin_display_name && this.state.cabin_display_name.length >= 2) {
            this.state.showCabinSuggestions = true;
        }
    }

    handleCabinBlur = () => {
        setTimeout(() => {
            this.state.showCabinSuggestions = false;
        }, 200);
    }

    getFilteredCabinSuggestions = () => {
        if (!this.state.cabin_input || this.state.cabin_input.length < 2) return [];

        const searchTerm = this.state.cabin_input.toLowerCase();
        return this.state.cabins.filter(cabin =>
            cabin.name.toLowerCase().includes(searchTerm)
        ).slice(0, 10);
    }

    selectCabin = (cabin) => {
        this.state.cabin_id = cabin.id;
        this.state.cabin_display_name = cabin.name;
        this.state.cabin_input = cabin.name;
        this.state.showCabinSuggestions = false;
    }

    // ==================== TREATMENT SCHEDULE HANDLING ====================

    handleTreatmentScheduleChange = async (scheduleId) => {
        this.clearError('selected_treatment_schedule_id');
        const id = scheduleId ? parseInt(scheduleId) : null;
        this.state.selected_treatment_schedule_id = id;
        this.state.selectedSessionTypes = [];

        if (id) {
            // Load schedule data
            try {
                const schedule = await this.orm.read(
                    'hms.treatment.schedule',
                    [id],
                    ['id', 'name', 'date', 'state', 'total_weeks', 'patient_id']
                );

                if (schedule && schedule[0]) {
                    this.state.selected_treatment_schedule = schedule[0];
                }
            } catch (error) {
                console.error('Error loading treatment schedule:', error);
            }

            await this.loadTreatmentScheduleLines();
        } else {
            this.state.selected_treatment_schedule = null;
            this.state.treatment_schedule_lines = [];
            this.state.total_weeks = 0;
        }
    }

    // ==================== SESSION TYPE & WEEK MANAGEMENT ====================

    getAvailableSessionTypes = () => {
        const selectedIds = this.state.selectedSessionTypes.map(st => st.line_id);
        return this.state.treatment_schedule_lines.filter(
            line => !selectedIds.includes(line.id)
        );
    }

    handleSessionTypeSelect = (lineId) => {
        const id = parseInt(lineId);
        if (!id) return;

        // Check if already selected
        const existingIndex = this.state.selectedSessionTypes.findIndex(st => st.line_id === id);
        if (existingIndex >= 0) {
            this.showNotification('This session type is already selected', 'warning');
            return;
        }

        const line = this.state.treatment_schedule_lines.find(l => l.id === id);
        if (!line) return;

        const totalWeeks = this.state.total_weeks || 0;
        const weeks = {};

        for (let i = 1; i <= totalWeeks; i++) {
            weeks[i] = {
                count: 0,
                appointments: []
            };
        }

        this.state.selectedSessionTypes = [
            ...this.state.selectedSessionTypes,
            {
                line_id: id,
                product_name: line.product_id ? line.product_id[1] : `Session ${id}`,
                weeks: weeks
            }
        ];
    }

    removeSessionType = (lineId) => {
        this.state.selectedSessionTypes = this.state.selectedSessionTypes.filter(
            st => st.line_id !== lineId
        );
    }

    getWeeksArray = () => {
        const weeks = [];
        for (let i = 1; i <= this.state.total_weeks; i++) {
            weeks.push({
                number: i,
                label: `Week ${i}`
            });
        }
        return weeks;
    }

    handleWeekCountChange = (sessionTypeIndex, weekNumber, count) => {
        const parsedCount = parseInt(count) || 0;
        const maxCount = 10;
        const finalCount = Math.min(Math.max(0, parsedCount), maxCount);

        const sessionType = this.state.selectedSessionTypes[sessionTypeIndex];
        if (!sessionType) return;

        const weekData = sessionType.weeks[weekNumber];
        if (!weekData) {
            // Initialize week data if it doesn't exist
            sessionType.weeks[weekNumber] = {
                count: 0,
                appointments: []
            };
        }

        const currentWeekData = sessionType.weeks[weekNumber];
        const currentCount = currentWeekData.appointments.length;

        if (finalCount > currentCount) {
            // Add more appointment slots
            for (let i = currentCount; i < finalCount; i++) {
                currentWeekData.appointments.push({
                    date: this.getTodayDate(),
                    startTime: '08:00',
                    endTime: '08:30'
                });
            }
        } else if (finalCount < currentCount) {
            // Remove extra appointment slots
            currentWeekData.appointments = currentWeekData.appointments.slice(0, finalCount);
        }

        currentWeekData.count = finalCount;

        // Clear any errors for this week
        this.clearAppointmentErrorsForWeek(sessionTypeIndex, weekNumber);

        // Force reactivity update
        this.state.selectedSessionTypes = [...this.state.selectedSessionTypes];
    }

    // ==================== APPOINTMENT TIME MANAGEMENT ====================

    toggleAppointmentTimeDropdown = (sessionTypeIndex, weekNumber, appointmentIndex, field) => {
        const dropdownKey = `${sessionTypeIndex}_${weekNumber}_${appointmentIndex}_${field}`;

        if (this.state.activeTimeDropdown === dropdownKey) {
            this.state.activeTimeDropdown = null;
        } else {
            this.state.activeTimeDropdown = dropdownKey;
        }
    }

    isTimeDropdownActive = (sessionTypeIndex, weekNumber, appointmentIndex, field) => {
        const dropdownKey = `${sessionTypeIndex}_${weekNumber}_${appointmentIndex}_${field}`;
        return this.state.activeTimeDropdown === dropdownKey;
    }

    selectAppointmentTime = (time, sessionTypeIndex, weekNumber, appointmentIndex, field) => {
        const sessionType = this.state.selectedSessionTypes[sessionTypeIndex];
        if (!sessionType) return;

        const weekData = sessionType.weeks[weekNumber];
        if (!weekData || !weekData.appointments[appointmentIndex]) return;

        if (field === 'start') {
            weekData.appointments[appointmentIndex].startTime = time;

            // Auto-calculate end time (+30 min)
            const [hours, minutes] = time.split(':').map(Number);
            const endMinutes = minutes + 30;
            const endHours = hours + Math.floor(endMinutes / 60);
            const finalEndMinutes = endMinutes % 60;
            weekData.appointments[appointmentIndex].endTime =
                `${String(endHours).padStart(2, '0')}:${String(finalEndMinutes).padStart(2, '0')}`;
        } else {
            weekData.appointments[appointmentIndex].endTime = time;
        }

        // Clear error for this field
        this.clearAppointmentError(sessionTypeIndex, weekNumber, appointmentIndex, field === 'start' ? 'startTime' : 'endTime');

        // Close dropdown
        this.state.activeTimeDropdown = null;

        // Force reactivity update
        this.state.selectedSessionTypes = [...this.state.selectedSessionTypes];
    }

    handleAppointmentDateChange = (sessionTypeIndex, weekNumber, appointmentIndex, date) => {
        const sessionType = this.state.selectedSessionTypes[sessionTypeIndex];
        if (!sessionType) return;

        const weekData = sessionType.weeks[weekNumber];
        if (!weekData || !weekData.appointments[appointmentIndex]) return;

        weekData.appointments[appointmentIndex].date = date;

        // Clear error for date
        this.clearAppointmentError(sessionTypeIndex, weekNumber, appointmentIndex, 'date');

        this.state.selectedSessionTypes = [...this.state.selectedSessionTypes];
    }

    calculateDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return 0;

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        const durationMinutes = endTotalMinutes - startTotalMinutes;
        return durationMinutes / 60; // Convert to hours
    }

    // ==================== TIME DROPDOWN UTILITIES ====================

    generateHourOptions = () => {
        const hours = [];
        for (let hour = 0; hour < 24; hour++) {
            hours.push(String(hour).padStart(2, '0'));
        }
        return hours;
    }

    getCurrentHour = (timeString) => {
        return timeString ? timeString.split(':')[0] : '00';
    }

    getCurrentMinute = (timeString) => {
        return timeString ? timeString.split(':')[1] : '00';
    }

    closeDropdowns = () => {
        setTimeout(() => {
            this.state.activeTimeDropdown = null;
        }, 200);
    }

    // ==================== TOTAL APPOINTMENTS COUNT ====================

    getTotalAppointmentsCount = () => {
        let total = 0;
        for (const sessionType of this.state.selectedSessionTypes) {
            for (const weekNum in sessionType.weeks) {
                total += sessionType.weeks[weekNum].count;
            }
        }
        return total;
    }

    // ==================== VALIDATION ====================

    validateAllAppointments = () => {
        const errors = {};
        let hasErrors = false;

        // Clear previous errors
        this.state.appointmentErrors = {};

        // Validate each appointment
        this.state.selectedSessionTypes.forEach((sessionType, sessionIndex) => {
            for (const weekNum in sessionType.weeks) {
                const weekData = sessionType.weeks[weekNum];
                weekData.appointments.forEach((appt, apptIndex) => {
                    const appointmentKey = `${sessionIndex}_${weekNum}_${apptIndex}`;

                    if (!appt.date) {
                        errors[`${appointmentKey}_date`] = 'Date is required';
                        hasErrors = true;
                    }

                    if (!appt.startTime) {
                        errors[`${appointmentKey}_startTime`] = 'Start time is required';
                        hasErrors = true;
                    }

                    if (!appt.endTime) {
                        errors[`${appointmentKey}_endTime`] = 'End time is required';
                        hasErrors = true;
                    }
                });
            }
        });

        this.state.appointmentErrors = errors;
        return !hasErrors;
    }

    clearAppointmentError = (sessionTypeIndex, weekNumber, appointmentIndex, field) => {
        const key = `${sessionTypeIndex}_${weekNumber}_${appointmentIndex}_${field}`;
        const newErrors = { ...this.state.appointmentErrors };
        delete newErrors[key];
        this.state.appointmentErrors = newErrors;
    }

    clearAppointmentErrorsForWeek = (sessionTypeIndex, weekNumber) => {
        const newErrors = {};
        Object.keys(this.state.appointmentErrors).forEach(key => {
            if (!key.startsWith(`${sessionTypeIndex}_${weekNumber}_`)) {
                newErrors[key] = this.state.appointmentErrors[key];
            }
        });
        this.state.appointmentErrors = newErrors;
    }

    getAppointmentFieldErrorClass = (sessionTypeIndex, weekNumber, appointmentIndex, field) => {
        const key = `${sessionTypeIndex}_${weekNumber}_${appointmentIndex}_${field}`;
        return this.state.appointmentErrors[key] ? 'is-invalid' : '';
    }

    getAppointmentFieldError = (sessionTypeIndex, weekNumber, appointmentIndex, field) => {
        const key = `${sessionTypeIndex}_${weekNumber}_${appointmentIndex}_${field}`;
        return this.state.appointmentErrors[key] || '';
    }

    // ==================== SAVE ALL APPOINTMENTS ====================

    saveAllAppointments = async () => {
        try {
            // Validate basic fields
            const errors = {};
            if (!this.state.patient_id) errors.patient_id = 'Please select a patient';
            if (!this.state.physician_id) errors.physician_id = 'Please select a physician';
            if (!this.state.cabin_id) errors.cabin_id = 'Please select a clinic';
            if (!this.state.selected_treatment_schedule_id) errors.selected_treatment_schedule_id = 'Please select a treatment schedule';
            if (this.state.selectedSessionTypes.length === 0) errors.session_types = 'Please add at least one session type';

            this.state.errors = errors;
            if (Object.keys(errors).length > 0) {
                return;
            }

            // Validate appointments
            if (!this.validateAllAppointments()) {
                this.showNotification('Please fill in all required fields for appointments', 'warning');
                return;
            }

            if (this.getTotalAppointmentsCount() === 0) {
                this.showNotification('No appointments to create. Please add at least one appointment.', 'warning');
                return;
            }

            this.state.saving = true;

            // Collect all appointments to create
            const appointmentsToCreate = [];

            for (const sessionType of this.state.selectedSessionTypes) {
                for (const weekNum in sessionType.weeks) {
                    const weekData = sessionType.weeks[weekNum];
                    for (const appt of weekData.appointments) {
                        // Create date strings
                        const startDateTime = `${appt.date} ${appt.startTime}:00`;
                        const endDateTime = `${appt.date} ${appt.endTime}:00`;

                        appointmentsToCreate.push({
                            patient_id: parseInt(this.state.patient_id),
                            physician_id: parseInt(this.state.physician_id),
                            cabin_id: parseInt(this.state.cabin_id),
                            consultation_type: 'treatment_schedule',
                            state: this.state.appointment_state,
                            date: startDateTime,
                            date_to: endDateTime,
                            treatment_schedule_line_id: sessionType.line_id,
                            treatment_week: weekNum.toString(),
                        });
                    }
                }
            }

            // Create all appointments
            const createdIds = await this.orm.create('hms.appointment', appointmentsToCreate);

            console.log('Created appointment IDs:', createdIds);

            // Link appointments to treatment schedule weeks
            let linkIndex = 0;
            for (const sessionType of this.state.selectedSessionTypes) {
                for (const weekNum in sessionType.weeks) {
                    const weekData = sessionType.weeks[weekNum];
                    for (let i = 0; i < weekData.appointments.length; i++) {
                        const appointmentId = createdIds[linkIndex];
                        if (appointmentId) {
                            try {
                                await this.linkAppointmentToWeek(
                                    sessionType.line_id,
                                    parseInt(weekNum),
                                    appointmentId
                                );
                            } catch (linkError) {
                                console.error('Error linking appointment to week:', linkError);
                            }
                        }
                        linkIndex++;
                    }
                }
            }

            this.showNotification(
                `Successfully created ${createdIds.length} appointment(s)`,
                'success'
            );

            // Close popup and refresh calendar
            setTimeout(() => {
                this.props.onSave();
                this.props.close();
            }, 500);

        } catch (error) {
            console.error('Error creating bulk appointments:', error);
            let errorMessage = 'Error creating appointments. ';
            if (error.data && error.data.message) {
                errorMessage += error.data.message;
            } else if (error.message) {
                errorMessage += error.message;
            }
            this.showNotification(errorMessage, 'danger');
        } finally {
            this.state.saving = false;
        }
    }

    linkAppointmentToWeek = async (lineId, weekNumber, appointmentId) => {
        try {
            const response = await fetch('/treatment_schedule/add_appointment_to_week', {
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
                        week_number: weekNumber,
                        appointment_id: appointmentId,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            const resultData = await response.json();
            const result = resultData.result || resultData;

            if (result.success) {
                console.log(`Appointment ${appointmentId} linked to Week ${weekNumber} of Line ${lineId}`);
            } else {
                console.warn('Warning linking appointment:', result.error);
            }
        } catch (error) {
            console.error('Error linking appointment to treatment schedule:', error);
        }
    }

    // ==================== UTILITY METHODS ====================

    getStatusColor = (state) => {
        const statusColors = {
            'draft': '#6c757d',
            'no_answer': '#fd7e14',
            'call_back': '#ffc107',
            'posponed': '#8d6e63',
            'confirm': '#17a2b8',
            'booked': '#007bff',
            'arrived': '#6f42c1',
            'waiting': '#0056b3',
            'treatment': '#e83e8c',
            'in_consultation': '#9561e2',
            'basic_7_floor': '#20c997',
            'pause': '#ff6b6b',
            'to_invoice': '#f39c12',
            'gig_insurance': '#28a745',
            'billed': '#155724',
            'done': '#28a745',
            'cancelled': '#dc3545',
            'blocked': '#721c24',
            'follow_up': '#5bc0de',
            'feels_good': '#8bc34a'
        };
        return statusColors[state] || '#607D8B';
    }

    getStateDisplayName = (state) => {
        const stateNames = {
            'draft': 'Draft',
            'no_answer': 'No Answer',
            'call_back': 'Call Back',
            'posponed': 'Postponed',
            'confirm': 'Confirmed',
            'booked': 'Booked',
            'arrived': 'Arrived',
            'waiting': 'Waiting',
            'treatment': 'Treatment',
            'in_consultation': 'In Consultation',
            'basic_7_floor': 'Basic 7th Floor',
            'pause': 'Paused',
            'to_invoice': 'To Invoice',
            'gig_insurance': 'GIG Insurance',
            'billed': 'Billed',
            'done': 'Done',
            'cancelled': 'Cancelled',
            'blocked': 'Blocked',
            'follow_up': 'Follow Up',
            'feels_good': 'Feels Good'
        };
        return stateNames[state] || state;
    }

    formatDuration = (hours) => {
        return Math.round(hours * 100) / 100;
    }

    showNotification = (message, type = 'info') => {
        this.notification.add(message, { type: type });
    }

    clearError = (field) => {
        if (this.state.errors[field]) {
            const newErrors = { ...this.state.errors };
            delete newErrors[field];
            this.state.errors = newErrors;
        }
    }

    getFieldErrorClass = (field) => {
        return this.state.errors[field] ? 'is-invalid' : '';
    }

    getFieldError = (field) => {
        return this.state.errors[field] || '';
    }

    handleFieldChange = (field, value) => {
        this.clearError(field);
        this.state[field] = value;
    }

    getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    }

    getMaxDate = () => {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear.toISOString().split('T')[0];
    }

    incrementWeekCount = (sessionTypeIndex, weekNumber) => {
        const sessionType = this.state.selectedSessionTypes[sessionTypeIndex];
        if (!sessionType) return;

        const weekData = sessionType.weeks[weekNumber];
        const currentCount = weekData ? weekData.count : 0;

        if (currentCount >= 10) return; // الحد الأقصى 10

        const newCount = currentCount + 1;
        this.handleWeekCountChange(sessionTypeIndex, weekNumber, newCount.toString());
    }

    decrementWeekCount = (sessionTypeIndex, weekNumber) => {
        const sessionType = this.state.selectedSessionTypes[sessionTypeIndex];
        if (!sessionType) return;

        const weekData = sessionType.weeks[weekNumber];
        const currentCount = weekData ? weekData.count : 0;

        if (currentCount <= 0) return; // الحد الأدنى 0

        const newCount = currentCount - 1;
        this.handleWeekCountChange(sessionTypeIndex, weekNumber, newCount.toString());
    }
}