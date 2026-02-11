/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { AppointmentFormValidation } from "./appointment_form_validation";

export class AppointmentFormPopup extends Component {
    static template = "CalendarByAssignee.AppointmentFormPopup";

    static props = ["*"];

    setup() {
        super.setup();

        this.orm = useService("orm");
        this.notification = useService("notification");
        this.action = useService("action");

        this.state = useState({
            loading: false,
            initialLoading: true,
            patient_id: null,
            physician_id: null,
            cabin_id: null,
            product_id: null,
            date: '',
            date_to: '',
            duration: 0.5,
            consultation_type: 'consultation',
            state: 'draft',
            notes: '',

            patients: [],
            physicians: [],
            cabins: [],
            consultationServices: [],
            currentAppointment: null,

            tempDate: '',
            tempStartTime: '08:00',
            tempEndTime: '08:30',

            showStartTimeDropdown: false,
            showEndTimeDropdown: false,
            activeTimeField: null,
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
            errors: {},
            serverError: null,
            validationErrors: {},

            patient_display_name: '',
            patient_input: '',
            showPatientSuggestions: false,
            physician_display_name: '',
            physician_input: '',
            showPhysicianSuggestions: false,
            cabin_display_name: '',
            cabin_input: '',
            showCabinSuggestions: false,

            session_type_display_name: '',
            session_type_input: '',
            showSessionTypeSuggestions: false,

            isCreatingPatient: false,
            selectedPatientInfo: null,
            patient_gender: null,

            treatment_schedules: [],
            selected_treatment_schedule_id: null,
            selected_treatment_schedule: null,
            treatment_schedule_lines: [],
            selected_session_type_id: null,
            available_weeks: [],
            selected_week: null,
            week_number: '',
            week_date: '',
            show_treatment_schedule_fields: false,
            loading_treatment_schedule: false,
            total_weeks: 0,
        });

        this.setupValidationState = AppointmentFormValidation.setupValidationState.bind(this);
        this.setupValidationState();

        this.showErrorNotification = AppointmentFormValidation.showErrorNotification.bind(this);
        this.showSuccessNotification = AppointmentFormValidation.showSuccessNotification.bind(this);
        this.showWarningNotification = AppointmentFormValidation.showWarningNotification.bind(this);
        this.getUserFriendlyErrorMessage = AppointmentFormValidation.getUserFriendlyErrorMessage.bind(this);
        this.extractValidationErrors = AppointmentFormValidation.extractValidationErrors.bind(this);
        this.formatServerErrorMessage = AppointmentFormValidation.formatServerErrorMessage.bind(this);
        this.validateForm = AppointmentFormValidation.validateForm.bind(this);

        this.validateAllConstraints = AppointmentFormValidation.validateAllConstraints.bind(this);
        this.checkPhysicianBreakPeriod = AppointmentFormValidation.checkPhysicianBreakPeriod.bind(this);
        this.checkPhysicianAppointmentOverlap = AppointmentFormValidation.checkPhysicianAppointmentOverlap.bind(this);
        this.checkCabinBreakPeriod = AppointmentFormValidation.checkCabinBreakPeriod.bind(this);
        this.checkCabinAppointmentConflict = AppointmentFormValidation.checkCabinAppointmentConflict.bind(this);
        this.getPatientGender = AppointmentFormValidation.getPatientGender.bind(this);
        this.formatDateOnlyForBackend = AppointmentFormValidation.formatDateOnlyForBackend.bind(this);
        this.formatDateTimeForBackend = AppointmentFormValidation.formatDateTimeForBackend.bind(this);

        this.saveAppointment = this.saveAppointmentFunction.bind(this);
        this.clearError = AppointmentFormValidation.clearError.bind(this);
        this.getFieldErrorClass = AppointmentFormValidation.getFieldErrorClass.bind(this);
        this.getFieldError = AppointmentFormValidation.getFieldError.bind(this);
        this.hasServerValidationError = AppointmentFormValidation.hasServerValidationError.bind(this);

        onMounted(async () => {
            this.state.initialLoading = true;

            try {
                await this.initializeData();
                if (this.props.mode === 'edit' && this.props.appointmentId) {
                    await this.loadAppointmentData();
                } else if (this.props.mode === 'create' && this.props.slotData) {
                    await this.initializeCreateData();
                }
            } catch (error) {
                this.showErrorNotification('Error loading form data', error);
            } finally {
                setTimeout(() => {
                    this.state.initialLoading = false;
                }, 300);
            }
        });
    }

    async saveAppointmentFunction() {
        try {
            this.state.loading = true;
            this.state.serverError = null;
            this.state.validationErrors = {};

            if (!this.validateForm()) {
                this.state.loading = false;
                return;
            }

            if (this.state.consultation_type === 'treatment_schedule') {
                if (!this.state.selected_treatment_schedule_id) {
                    this.showErrorNotification('Please select a Treatment Schedule');
                    this.state.loading = false;
                    return;
                }
                if (!this.state.selected_session_type_id) {
                    this.showErrorNotification('Please select a Session Type');
                    this.state.loading = false;
                    return;
                }
                if (!this.state.selected_week) {
                    this.showErrorNotification('Please select a Week');
                    this.state.loading = false;
                    return;
                }
            }

            const physicianId = parseInt(this.state.physician_id);
            const cabinId = parseInt(this.state.cabin_id);
            const patientId = parseInt(this.state.patient_id);
            const productId = parseInt(this.state.product_id);

            if (isNaN(physicianId) || isNaN(cabinId) || isNaN(patientId) || isNaN(productId)) {
                this.showErrorNotification('Please select all required fields with valid values.');
                this.state.loading = false;
                return;
            }

            const startTimeParts = this.state.tempStartTime.split(':');
            const hour = parseInt(startTimeParts[0]);
            const duration = this.state.duration || 1;

            const patientGender = this.getPatientGender();

            const isValid = await this.validateAllConstraints(
                physicianId,
                cabinId,
                this.state.tempDate,
                hour,
                duration,
                this.props.mode === 'edit' ? this.props.appointmentId : null,
                patientGender
            );

            if (!isValid) {
                this.state.loading = false;
                return;
            }

            const startTimeStr = this.state.tempStartTime.includes(':') ?
                this.state.tempStartTime :
                this.state.tempStartTime + ':00';
            const endTimeStr = this.state.tempEndTime.includes(':') ?
                this.state.tempEndTime :
                this.state.tempEndTime + ':00';

            const startDateLocal = new Date(this.state.tempDate + 'T' + startTimeStr);
            const endDateLocal = new Date(this.state.tempDate + 'T' + endTimeStr);

            if (this.props.mode === 'edit') {
                startDateLocal.setHours(startDateLocal.getHours());
                endDateLocal.setHours(endDateLocal.getHours());
            }

            const appointmentDate = this.formatDateTimeForBackend(startDateLocal);
            const appointmentDateTo = this.formatDateTimeForBackend(endDateLocal);

            const appointmentData = {
                patient_id: patientId,
                physician_id: physicianId,
                cabin_id: cabinId,
                product_id: productId,
                date: appointmentDate,
                date_to: appointmentDateTo,
                consultation_type: this.state.consultation_type,
                state: this.state.state,
                notes: this.state.notes || ''
            };

            if (this.state.consultation_type === 'treatment_schedule') {
                appointmentData.treatment_schedule_id = this.state.selected_treatment_schedule_id;
                appointmentData.treatment_schedule_line_id = this.state.selected_session_type_id;
                appointmentData.treatment_week = this.state.selected_week.toString();
            }

            let result;
            let appointmentId;

            if (this.props.mode === 'create') {
                const createdIds = await this.orm.create('hms.appointment', [appointmentData]);

                // Extract the appointment ID from the returned array
                if (Array.isArray(createdIds) && createdIds.length > 0) {
                    appointmentId = createdIds[0];
                    this.showSuccessNotification('Appointment created successfully');

                    // Link to treatment schedule after creation
                    if (this.state.consultation_type === 'treatment_schedule' && appointmentId) {
                        await this.linkAppointmentToTreatmentSchedule(appointmentId);
                    }
                } else {
                    this.showErrorNotification('Failed to create appointment');
                    this.state.loading = false;
                    return;
                }
            } else {
                appointmentId = this.props.appointmentId;
                result = await this.orm.write('hms.appointment', [appointmentId], appointmentData);
                this.showSuccessNotification('Appointment updated successfully');

                // Link to treatment schedule after update
                if (this.state.consultation_type === 'treatment_schedule') {
                    await this.linkAppointmentToTreatmentSchedule(appointmentId);
                }
            }

            if (result || appointmentId) {
                setTimeout(() => {
                    this.props.onSave();
                    this.props.close();
                }, 100);
            }

        } catch (error) {
            let errorMessage = 'Unable to save appointment. ';
            if (error.data && error.data.message) {
                errorMessage += error.data.message;
            } else if (error.message) {
                errorMessage += error.message;
            }

            this.showErrorNotification(errorMessage, 'Save Error');
            this.state.serverError = error;
        } finally {
            this.state.loading = false;
        }
    }

    async linkAppointmentToTreatmentSchedule(appointmentId) {
        try {
            // Ensure appointmentId is a number, not a list
            let appointmentIdToSend = appointmentId;

            if (Array.isArray(appointmentId)) {
                console.log('linkAppointmentToTreatmentSchedule: appointmentId is an array, taking first element', appointmentId);
                appointmentIdToSend = appointmentId[0];
            }

            if (!this.state.selected_treatment_schedule_id ||
                !this.state.selected_session_type_id ||
                !this.state.selected_week ||
                !appointmentIdToSend) {
                console.warn('Missing required data for linking appointment to treatment schedule:', {
                    schedule_id: this.state.selected_treatment_schedule_id,
                    line_id: this.state.selected_session_type_id,
                    week: this.state.selected_week,
                    appointmentId: appointmentIdToSend
                });
                return;
            }

            console.log('Linking appointment to treatment schedule:', {
                line_id: this.state.selected_session_type_id,
                week_number: parseInt(this.state.selected_week),
                appointment_id: appointmentIdToSend
            });

            // Add appointment to treatment schedule week using API (same as bulk appointment)
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
                        line_id: this.state.selected_session_type_id,
                        week_number: parseInt(this.state.selected_week),
                        appointment_id: appointmentIdToSend,
                    },
                    id: Math.floor(Math.random() * 1000)
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const resultData = await response.json();

            // Handle both RPC format and direct result
            const result = resultData.result || resultData;
            console.log('Link appointment response:', result);

            if (result && result.success === true) {
                console.log('Appointment linked to treatment schedule successfully');
                this.showSuccessNotification('Appointment linked to treatment schedule');

                // Also update the appointment record with treatment schedule info
                await this.orm.write('hms.appointment', [appointmentIdToSend], {
                    treatment_schedule_id: this.state.selected_treatment_schedule_id,
                    treatment_schedule_line_id: this.state.selected_session_type_id,
                    treatment_week: this.state.selected_week.toString()
                });

            } else {
                const errorMsg = result.error || result.message || 'Unknown error';
                console.warn('Warning: Could not link appointment to treatment schedule:', errorMsg);
                this.showWarningNotification('Appointment created but could not link to treatment schedule. Please link manually.');
            }
        } catch (error) {
            console.error('Error linking appointment to treatment schedule:', error);
            this.showWarningNotification('Appointment created but could not link to treatment schedule. Please link manually.');
        }
    }

    initializeData = async () => {
        try {
            const [patients, physicians, cabins, services] = await Promise.all([
                this.orm.searchRead('hms.patient', [], ['id', 'name', 'mobile', 'phone', 'gender', 'age', 'code']),
                this.orm.searchRead('hms.physician', [['active', '=', true]], ['id', 'name']),
                this.orm.searchRead('appointment.cabin', [], ['id', 'name']),
                this.orm.searchRead('product.product', [['hospital_product_type', '=', 'consultation']], ['id', 'name'])
            ]);

            this.state.patients = patients;
            this.state.physicians = physicians;
            this.state.cabins = cabins;
            this.state.consultationServices = services;

        } catch (error) {
            this.showErrorNotification('Error loading form data', error);
            throw error;
        }
    }

    initializeCreateData = async () => {
        const slotData = this.props.slotData;

        if (slotData.cabinId) {
            this.state.cabin_id = parseInt(slotData.cabinId);
        }

        if (slotData.physicianId) {
            this.state.physician_id = parseInt(slotData.physicianId);
        }

        const today = new Date();
        this.state.tempDate = today.toISOString().split('T')[0];
        this.state.tempStartTime = '08:00';
        this.state.tempEndTime = '08:30';

        if (slotData.date || slotData.hour !== undefined) {
            const startTime = this.calculateNewEventTime(slotData);
            if (startTime && !isNaN(startTime.getTime())) {
                const endTime = new Date(startTime);
                endTime.setMinutes(endTime.getMinutes() + 30);

                this.state.tempDate = this.formatDateForDisplay(startTime);
                this.state.tempStartTime = this.formatTimeForDisplay(startTime);
                this.state.tempEndTime = this.formatTimeForDisplay(endTime);

                this.updateDatabaseFieldsWithLocalTimes(startTime, endTime);
            }
        } else {
            this.updateDatabaseFields();
        }

        if (this.state.consultationServices.length > 0) {
            this.state.product_id = this.state.consultationServices[0].id;
        }

        if (slotData.physicianId) {
            const physicianId = parseInt(slotData.physicianId);
            const physician = this.state.physicians.find(p => p.id === physicianId);
            if (physician) {
                this.state.physician_display_name = physician.name;
            }
        }

        if (slotData.cabinId) {
            const cabinId = parseInt(slotData.cabinId);
            const cabin = this.state.cabins.find(c => c.id === cabinId);
            if (cabin) {
                this.state.cabin_display_name = cabin.name;
            }
        }
    }

    loadAppointmentData = async () => {
        try {
            this.state.loading = true;

            console.log('🚀 [DEBUG] Starting to load appointment data for ID:', this.props.appointmentId);

            const appointments = await this.orm.read(
                'hms.appointment',
                [this.props.appointmentId],
                ['patient_id', 'physician_id', 'cabin_id',
                 'product_id', 'date', 'date_to', 'consultation_type', 'state', 'name',
                 'treatment_schedule_id', 'treatment_schedule_line_id', 'treatment_week']
            );

            if (appointments && appointments[0]) {
                this.state.currentAppointment = appointments[0];
                const appointment = appointments[0];

                console.log('📋 [DEBUG] Loaded appointment data:', {
                    appointment_id: this.props.appointmentId,
                    consultation_type: appointment.consultation_type,
                    treatment_schedule_id: appointment.treatment_schedule_id,
                    treatment_schedule_line_id: appointment.treatment_schedule_line_id,
                    treatment_week: appointment.treatment_week
                });

                this.state.patient_id = appointment.patient_id ? parseInt(appointment.patient_id[0]) : null;
                this.state.physician_id = appointment.physician_id ? parseInt(appointment.physician_id[0]) : null;
                this.state.cabin_id = appointment.cabin_id ? parseInt(appointment.cabin_id[0]) : null;
                this.state.product_id = appointment.product_id ? parseInt(appointment.product_id[0]) : null;
                this.state.date = appointment.date;
                this.state.date_to = appointment.date_to;
                this.state.consultation_type = appointment.consultation_type || 'consultation';
                this.state.state = appointment.state;

                // Load treatment week if exists
                if (appointment.treatment_week) {
                    this.state.selected_week = parseInt(appointment.treatment_week);
                    console.log('📅 [DEBUG] Set treatment week:', this.state.selected_week);
                }

                try {
                    const notesAppointment = await this.orm.read(
                        'hms.appointment',
                        [this.props.appointmentId],
                        ['notes']
                    );
                    if (notesAppointment && notesAppointment[0]) {
                        this.state.notes = notesAppointment[0].notes || '';
                    } else {
                        this.state.notes = '';
                    }
                } catch (notesError) {
                    this.state.notes = '';
                }

                if (this.state.consultation_type === 'treatment_schedule' && this.state.patient_id) {
                    this.state.show_treatment_schedule_fields = true;
                    console.log('🔄 [DEBUG] Loading treatment schedules for patient:', this.state.patient_id);
                    await this.loadTreatmentSchedules();

                    if (appointment.treatment_schedule_id && appointment.treatment_schedule_id[0]) {
                        const scheduleId = parseInt(appointment.treatment_schedule_id[0]);
                        console.log('📋 [DEBUG] Setting treatment schedule ID:', scheduleId);
                        this.state.selected_treatment_schedule_id = scheduleId;
                        
                        // First load the treatment schedule data
                        await this.loadTreatmentScheduleData();
                        
                        // Then load the treatment schedule lines
                        await this.loadTreatmentScheduleLines();
                        
                        // Load session type from treatment schedule line
                        if (appointment.treatment_schedule_line_id && appointment.treatment_schedule_line_id[0]) {
                            const lineId = parseInt(appointment.treatment_schedule_line_id[0]);
                            console.log('📋 [DEBUG] Setting session type ID:', lineId);
                            this.state.selected_session_type_id = lineId;

                            // Find and set the session type name
                            if (this.state.treatment_schedule_lines.length > 0) {
                                const line = this.state.treatment_schedule_lines.find(l => l.id === lineId);
                                console.log('🔍 [DEBUG] Looking for line ID', lineId, 'in lines:', this.state.treatment_schedule_lines);
                                if (line) {
                                    console.log('✅ [DEBUG] Found line:', line);
                                    if (line.product_id) {
                                        this.state.session_type_display_name = line.product_id[1];
                                        console.log('✅ [DEBUG] Set session type display name:', this.state.session_type_display_name);
                                    }
                                } else {
                                    console.warn('⚠️ [DEBUG] Line not found for ID:', lineId);
                                }
                            } else {
                                console.warn('⚠️ [DEBUG] No treatment schedule lines loaded');
                            }
                        } else {
                            console.log('📋 [DEBUG] No treatment_schedule_line_id found in appointment');
                        }
                    } else {
                        console.log('📋 [DEBUG] No treatment_schedule_id found in appointment');
                    }
                }

                const startTime = this.parseDateFromBackendCorrectly(appointment.date);
                const endTime = this.parseDateFromBackendCorrectly(appointment.date_to);

                this.state.tempDate = this.formatDateForDisplay(startTime);
                this.state.tempStartTime = this.formatTimeForDisplay(startTime);
                this.state.tempEndTime = this.formatTimeForDisplay(endTime);

                const durationMs = endTime.getTime() - startTime.getTime();
                this.state.duration = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

                if (appointment.patient_id && appointment.patient_id[1]) {
                    this.state.patient_display_name = appointment.patient_id[1];

                    const patientId = appointment.patient_id[0];
                    const patientData = await this.orm.searchRead(
                        'hms.patient',
                        [['id', '=', patientId]],
                        ['name', 'mobile', 'phone', 'gender', 'age', 'code']
                    );

                    if (patientData && patientData[0]) {
                        this.state.selectedPatientInfo = {
                            name: patientData[0].name,
                            mobile: patientData[0].mobile || 'Not provided',
                            phone: patientData[0].phone || 'Not provided',
                            code: patientData[0].code || 'Not provided',
                            gender: this.getGenderText(patientData[0].gender),
                            age: patientData[0].age ? `${patientData[0].age} years` : 'Not provided'
                        };
                        this.state.patient_gender = patientData[0].gender;
                    }
                }

                if (appointment.physician_id && appointment.physician_id[1]) {
                    this.state.physician_display_name = appointment.physician_id[1];
                }

                if (appointment.cabin_id && appointment.cabin_id[1]) {
                    this.state.cabin_display_name = appointment.cabin_id[1];
                }
            }

            console.log('✅ [DEBUG] Appointment data loaded successfully');
            console.log('📋 [DEBUG] Final state:', {
                consultation_type: this.state.consultation_type,
                selected_treatment_schedule_id: this.state.selected_treatment_schedule_id,
                selected_session_type_id: this.state.selected_session_type_id,
                session_type_display_name: this.state.session_type_display_name,
                treatment_schedule_lines_count: this.state.treatment_schedule_lines.length,
                show_treatment_schedule_fields: this.state.show_treatment_schedule_fields
            });

        } catch (error) {
            console.error('❌ [ERROR] Error loading appointment data:', error);
            this.showErrorNotification('Error loading appointment data', error);
            throw error;
        } finally {
            this.state.loading = false;
        }
    }

    handleNotesChange = (value) => {
        this.clearError('notes');
        this.state.notes = value;
    }

    handleConsultationTypeChange = (value) => {
        this.clearError('consultation_type');
        this.state.consultation_type = value;
        this.state.show_treatment_schedule_fields = (value === 'treatment_schedule');

        if (value !== 'treatment_schedule') {
            this.state.selected_treatment_schedule_id = null;
            this.state.selected_treatment_schedule = null;
            this.state.treatment_schedule_lines = [];
            this.state.selected_session_type_id = null;
            this.state.session_type_display_name = '';
            this.state.available_weeks = [];
            this.state.selected_week = null;
            this.state.week_number = '';
            this.state.week_date = '';
            this.state.total_weeks = 0;
        } else if (value === 'treatment_schedule' && this.state.patient_id) {
            this.loadTreatmentSchedules();
        }
    }

    loadTreatmentSchedules = async () => {
        try {
            if (!this.state.patient_id) {
                this.state.treatment_schedules = [];
                return;
            }

            this.state.loading_treatment_schedule = true;
            console.log('🔄 [DEBUG] Loading treatment schedules for patient ID:', this.state.patient_id);

            // Search for treatment schedules with state 'in_progress' or 'draft'
            const schedules = await this.orm.searchRead(
                'hms.treatment.schedule',
                [
                    ['patient_id', '=', this.state.patient_id],
                    ['state', 'in', ['draft', 'in_progress']]
                ],
                ['id', 'name', 'date', 'state', 'total_weeks', 'patient_id']
            );

            console.log('✅ [DEBUG] Loaded treatment schedules:', schedules);
            this.state.treatment_schedules = schedules;
        } catch (error) {
            console.error('❌ [ERROR] Error loading treatment schedules:', error);
            this.showErrorNotification('Error loading treatment schedules', error);
        } finally {
            this.state.loading_treatment_schedule = false;
        }
    }

    handleTreatmentScheduleChange = async (scheduleId) => {
        this.clearError('selected_treatment_schedule_id');

        const id = scheduleId ? parseInt(scheduleId) : null;
        this.state.selected_treatment_schedule_id = id;
        this.state.selected_session_type_id = null;
        this.state.session_type_display_name = '';
        this.state.available_weeks = [];
        this.state.selected_week = null;
        this.state.week_number = '';
        this.state.week_date = '';
        this.state.total_weeks = 0;

        console.log('🔄 [DEBUG] Treatment schedule changed to:', id);

        if (id) {
            await this.loadTreatmentScheduleData();
            await this.loadTreatmentScheduleLines();
        } else {
            this.state.selected_treatment_schedule = null;
            this.state.treatment_schedule_lines = [];
        }
    }

    loadTreatmentScheduleData = async () => {
        try {
            if (!this.state.selected_treatment_schedule_id) return;

            this.state.loading_treatment_schedule = true;
            console.log('🔄 [DEBUG] Loading treatment schedule data for ID:', this.state.selected_treatment_schedule_id);

            const schedule = await this.orm.read(
                'hms.treatment.schedule',
                [this.state.selected_treatment_schedule_id],
                ['id', 'name', 'date', 'state', 'total_weeks', 'patient_id']
            );

            if (schedule && schedule[0]) {
                this.state.selected_treatment_schedule = schedule[0];
                this.state.total_weeks = parseInt(schedule[0].total_weeks) || 0;
                console.log('✅ [DEBUG] Loaded treatment schedule:', schedule[0]);

                // Generate available weeks based on total_weeks
                this.generateAvailableWeeks();
            }
        } catch (error) {
            console.error('❌ [ERROR] Error loading treatment schedule details:', error);
            this.showErrorNotification('Error loading treatment schedule details', error);
        } finally {
            this.state.loading_treatment_schedule = false;
        }
    }

    loadTreatmentScheduleLines = async () => {
        try {
            if (!this.state.selected_treatment_schedule_id) return;

            console.log('🔄 [DEBUG] Loading treatment schedule lines for schedule ID:', this.state.selected_treatment_schedule_id);

            const lines = await this.orm.searchRead(
                'hms.treatment.schedule.line',
                [['schedule_id', '=', this.state.selected_treatment_schedule_id]],
                ['id', 'product_id', 'sequence'],
                { order: 'sequence' }
            );

            console.log('✅ [DEBUG] Loaded treatment schedule lines:', lines);
            this.state.treatment_schedule_lines = lines;

            // If we have a selected session type ID, set the display name
            if (this.state.selected_session_type_id && lines.length > 0) {
                const line = lines.find(l => l.id === this.state.selected_session_type_id);
                if (line && line.product_id) {
                    this.state.session_type_display_name = line.product_id[1];
                    console.log('✅ [DEBUG] Auto-set session type display name:', this.state.session_type_display_name);
                }
            }
        } catch (error) {
            console.error('❌ [ERROR] Error loading treatment schedule lines:', error);
        }
    }

    generateAvailableWeeks = () => {
        const weeks = [];
        const totalWeeks = this.state.total_weeks || 0;

        console.log('🔄 [DEBUG] Generating available weeks, total weeks:', totalWeeks);

        for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
            weeks.push({
                number: weekNum,
                label: `Week ${weekNum}`,
                is_available: true
            });
        }

        this.state.available_weeks = weeks;
        console.log('✅ [DEBUG] Generated available weeks:', weeks);
    }

    handleSessionTypeChange = (lineId) => {
        this.clearError('selected_session_type_id');

        const id = lineId ? parseInt(lineId) : null;
        this.state.selected_session_type_id = id;

        console.log('🔄 [DEBUG] Session type changed to:', id);

        if (id) {
            // Find and set the session type name
            const line = this.state.treatment_schedule_lines.find(l => l.id === id);
            if (line) {
                console.log('✅ [DEBUG] Found line for session type:', line);
                if (line.product_id) {
                    this.state.session_type_display_name = line.product_id[1];
                    console.log('✅ [DEBUG] Set session type display name:', this.state.session_type_display_name);
                }
            } else {
                console.warn('⚠️ [DEBUG] Line not found for session type ID:', id);
            }
        } else {
            this.state.session_type_display_name = '';
        }
    }

    handleWeekChange = (weekNumber) => {
        this.clearError('selected_week');

        const weekNum = parseInt(weekNumber);
        this.state.selected_week = weekNum;
        console.log('🔄 [DEBUG] Week changed to:', weekNum);
    }

    parseDateFromBackendCorrectly = (dateString) => {
        if (!dateString) return new Date();

        try {
            const [datePart, timePart] = dateString.split(' ');
            const [year, month, day] = datePart.split('-');
            const [hours, minutes, seconds] = timePart.split(':');

            const utcDate = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds)
            ));

            return utcDate;
        } catch (error) {
            return new Date();
        }
    }

    handlePatientInput = (value) => {
        this.clearError('patient_id');
        this.state.patient_display_name = value;
        this.state.patient_input = value;

        this.state.isCreatingPatient = false;

        if (value.length >= 2) {
            this.state.showPatientSuggestions = true;
        } else {
            this.state.showPatientSuggestions = false;
        }

        if (this.state.consultation_type === 'treatment_schedule' && this.state.patient_id) {
            this.loadTreatmentSchedules();
        }
    }

    handlePatientFocus = () => {
        if (!this.state.isCreatingPatient && this.state.patient_display_name && this.state.patient_display_name.length >= 2) {
            this.state.showPatientSuggestions = true;
        }
    }

    handlePatientBlur = () => {
        setTimeout(() => {
            if (!this.state.isCreatingPatient) {
                this.state.showPatientSuggestions = false;

                if (this.state.patient_display_name && !this.state.patient_id) {
                    const exactMatch = this.state.patients.find(patient =>
                        patient.name.toLowerCase() === this.state.patient_display_name.toLowerCase()
                    );
                    if (exactMatch) {
                        this.selectPatient(exactMatch);
                    }
                }
            }
        }, 200);
    }

    togglePatientSuggestions = () => {
        if (!this.state.isCreatingPatient) {
            this.state.showPatientSuggestions = !this.state.showPatientSuggestions;
            if (this.state.showPatientSuggestions && !this.state.patient_input) {
                this.state.patient_input = this.state.patient_display_name || '';
            }
        }
    }

    getFilteredPatientSuggestions = () => {
        if (!this.state.patient_input || this.state.patient_input.length < 2) {
            return [];
        }

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
        this.state.isCreatingPatient = false;

        const phoneToShow = patient.mobile || patient.phone || 'Not provided';
        const codeToShow = patient.code || 'Not provided';

        this.state.selectedPatientInfo = {
            name: patient.name,
            phone: phoneToShow,
            code: codeToShow,
            gender: this.getGenderText(patient.gender),
            age: patient.age ? `${patient.age} years` : 'Not provided',
            total_due: patient.total_due || 0.0
        };

        this.state.patient_gender = patient.gender;

        if (this.state.consultation_type === 'treatment_schedule') {
            this.loadTreatmentSchedules();
        }
    }

    getGenderText = (gender) => {
        switch(gender) {
            case 'male': return 'Male';
            case 'female': return 'Female';
            default: return 'Not specified';
        }
    }

    createNewPatient = async () => {
        if (!this.state.patient_input || this.state.patient_input.trim() === '') {
            this.showWarningNotification('Please enter a patient name');
            return;
        }

        try {
            this.state.isCreatingPatient = true;
            this.state.loading = true;

            const patientName = this.state.patient_input.trim();

            const existingPatients = await this.orm.searchRead('hms.patient',
                [['name', '=', patientName]],
                ['id', 'name', 'mobile', 'phone', 'gender', 'age', 'total_due', 'code']
            );

            let selectedPatient = null;

            if (existingPatients && existingPatients.length > 0) {
                selectedPatient = existingPatients[0];
                this.showSuccessNotification('Patient already exists and has been selected');
            } else {
                const newPatientId = await this.orm.create('hms.patient', [{
                    'name': patientName
                }]);

                if (newPatientId) {
                    const freshPatients = await this.orm.searchRead('hms.patient',
                        [['name', '=', patientName]],
                        ['id', 'name', 'mobile', 'phone', 'gender', 'age', 'total_due', 'code']
                    );

                    this.state.patients = await this.orm.searchRead('hms.patient', [], ['id', 'name', 'mobile', 'phone', 'gender', 'age', 'total_due', 'code']);

                    selectedPatient = freshPatients.find(p => p.id === newPatientId);

                    if (!selectedPatient) {
                        selectedPatient = freshPatients.find(p => p.name === patientName);
                    }

                    this.showSuccessNotification('Patient created successfully');
                }
            }

            if (selectedPatient) {
                this.selectPatient(selectedPatient);
            }

        } catch (error) {
            let errorMessage = 'Error creating patient';
            if (error.data && error.data.message) {
                errorMessage = error.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            this.showErrorNotification(errorMessage);
        } finally {
            this.state.loading = false;
            setTimeout(() => {
                this.state.isCreatingPatient = false;
            }, 100);
        }
    }

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
        if (!this.state.isCreatingPatient && this.state.physician_display_name && this.state.physician_display_name.length >= 2) {
            this.state.showPhysicianSuggestions = true;
        }
    }

    handlePhysicianBlur = () => {
        setTimeout(() => {
            if (!this.state.isCreatingPatient) {
                this.state.showPhysicianSuggestions = false;

                if (this.state.physician_display_name && !this.state.physician_id) {
                    const exactMatch = this.state.physicians.find(physician =>
                        physician.name.toLowerCase() === this.state.physician_display_name.toLowerCase()
                    );
                    if (exactMatch) {
                        this.state.physician_id = exactMatch.id;
                        this.state.physician_display_name = exactMatch.name;
                    }
                }
            }
        }, 200);
    }

    togglePhysicianSuggestions = () => {
        if (!this.state.isCreatingPatient) {
            this.state.showPhysicianSuggestions = !this.state.showPhysicianSuggestions;
            if (this.state.showPhysicianSuggestions && !this.state.physician_input) {
                this.state.physician_input = this.state.physician_display_name || '';
            }
        }
    }

    getFilteredPhysicianSuggestions = () => {
        if (this.state.isCreatingPatient) {
            return [];
        }

        if (!this.state.physician_input || this.state.physician_input.length < 2) {
            return [];
        }

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
        if (!this.state.isCreatingPatient && this.state.cabin_display_name && this.state.cabin_display_name.length >= 2) {
            this.state.showCabinSuggestions = true;
        }
    }

    handleCabinBlur = () => {
        setTimeout(() => {
            if (!this.state.isCreatingPatient) {
                this.state.showCabinSuggestions = false;

                if (this.state.cabin_display_name && !this.state.cabin_id) {
                    const exactMatch = this.state.cabins.find(cabin =>
                        cabin.name.toLowerCase() === this.state.cabin_display_name.toLowerCase()
                    );
                    if (exactMatch) {
                        this.state.cabin_id = exactMatch.id;
                        this.state.cabin_display_name = exactMatch.name;
                    }
                }
            }
        }, 200);
    }

    toggleCabinSuggestions = () => {
        if (!this.state.isCreatingPatient) {
            this.state.showCabinSuggestions = !this.state.showCabinSuggestions;
            if (this.state.showCabinSuggestions && !this.state.cabin_input) {
                this.state.cabin_input = this.state.cabin_display_name || '';
            }
        }
    }

    getFilteredCabinSuggestions = () => {
        if (this.state.isCreatingPatient) {
            return [];
        }

        if (!this.state.cabin_input || this.state.cabin_input.length < 2) {
            return [];
        }

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

    handleFieldChange = (field, value) => {
        this.clearError(field);

        let newValue;
        if (value === '' || value === null || value === undefined) {
            newValue = null;
        } else if (field === 'consultation_type') {
            this.handleConsultationTypeChange(value);
            return;
        } else if (field === 'state') {
            newValue = value;
        } else {
            newValue = parseInt(value);
        }

        this.state[field] = newValue;
    }

    handleDateChange = (newDate) => {
        this.clearError('tempDate');
        this.state.tempDate = newDate;
        this.updateDatabaseFieldsFromLocalInputs();
    }

    handleStartTimeChange = (newTime) => {
        this.clearError('tempStartTime');
        this.state.tempStartTime = newTime;
        this.updateDatabaseFieldsFromLocalInputs();
    }

    handleEndTimeChange = (newTime) => {
        this.clearError('tempEndTime');
        this.state.tempEndTime = newTime;
        this.updateDatabaseFieldsFromLocalInputs();
    }

    toggleTimeDropdown = (field) => {
        if (field === 'start') {
            this.state.showStartTimeDropdown = !this.state.showStartTimeDropdown;
            this.state.showEndTimeDropdown = false;
            this.state.activeTimeField = 'start';
        } else {
            this.state.showEndTimeDropdown = !this.state.showEndTimeDropdown;
            this.state.showStartTimeDropdown = false;
            this.state.activeTimeField = 'end';
        }
    }

    selectTime = (time, field) => {
        if (field === 'start') {
            this.clearError('tempStartTime');
            this.state.tempStartTime = time;
            this.state.showStartTimeDropdown = false;
        } else {
            this.clearError('tempEndTime');
            this.state.tempEndTime = time;
            this.state.showEndTimeDropdown = false;
        }
        this.updateDatabaseFieldsFromLocalInputs();
    }

    closeDropdowns = () => {
        setTimeout(() => {
            this.state.showStartTimeDropdown = false;
            this.state.showEndTimeDropdown = false;
            this.state.activeTimeField = null;
        }, 200);
    }

    updateDatabaseFieldsFromLocalInputs = () => {
        if (this.state.tempDate && this.state.tempStartTime && this.state.tempEndTime) {
            try {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

                if (!dateRegex.test(this.state.tempDate)) {
                    return;
                }

                if (!timeRegex.test(this.state.tempStartTime) || !timeRegex.test(this.state.tempEndTime)) {
                    return;
                }

                const startTimeStr = this.state.tempStartTime.includes(':') ?
                    this.state.tempStartTime :
                    this.state.tempStartTime + ':00';
                const endTimeStr = this.state.tempEndTime.includes(':') ?
                    this.state.tempEndTime :
                    this.state.tempEndTime + ':00';

                const startDateLocal = new Date(this.state.tempDate + 'T' + startTimeStr);
                const endDateLocal = new Date(this.state.tempDate + 'T' + endTimeStr);

                if (isNaN(startDateLocal.getTime()) || isNaN(endDateLocal.getTime())) {
                    return;
                }

                const durationMs = endDateLocal.getTime() - startDateLocal.getTime();
                const durationHours = durationMs / (1000 * 60 * 60);
                this.state.duration = Math.round(durationHours * 100) / 100;

                this.state.date = this.formatDateTimeForBackend(startDateLocal);
                this.state.date_to = this.formatDateTimeForBackend(endDateLocal);

            } catch (error) {
                this.showErrorNotification('Error calculating appointment time', error);
            }
        }
    }

    updateDatabaseFieldsWithLocalTimes = (startLocal, endLocal) => {
        try {
            const durationMs = endLocal.getTime() - startLocal.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);
            this.state.duration = Math.round(durationHours * 100) / 100;

            this.state.date = this.formatDateTimeForBackend(startLocal);
            this.state.date_to = this.formatDateTimeForBackend(endLocal);

        } catch (error) {
            this.showErrorNotification('Error setting appointment time', error);
        }
    }

    updateDatabaseFields = () => {
        const today = new Date();
        const startLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0);
        const endLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 30, 0);

        this.updateDatabaseFieldsWithLocalTimes(startLocal, endLocal);
    }

    openFullForm = () => {
        if (this.props.mode === 'edit' && this.props.appointmentId) {
            this.props.close();
            this.action.doAction({
                type: 'ir.actions.act_window',
                res_model: 'hms.appointment',
                res_id: this.props.appointmentId,
                views: [[false, 'form']],
                target: 'current',
            });
        } else {
            this.props.close();
            this.action.doAction({
                type: 'ir.actions.act_window',
                res_model: 'hms.appointment',
                views: [[false, 'form']],
                target: 'current',
                context: this.getFormContext()
            });
        }
    }

    getFormContext = () => {
        const context = {};
        if (this.state.date) context.default_date = this.state.date;
        if (this.state.date_to) context.default_date_to = this.state.date_to;
        if (this.state.physician_id) context.default_physician_id = this.state.physician_id;
        if (this.state.cabin_id) context.default_cabin_id = this.state.cabin_id;
        if (this.state.state) context.default_state = this.state.state;
        if (this.state.consultation_type === 'treatment_schedule' && this.state.selected_treatment_schedule_id) {
            context.default_treatment_schedule_id = this.state.selected_treatment_schedule_id;
        }
        if (this.state.notes) context.default_notes = this.state.notes;

        return context;
    }

    formatDateTimeForBackend = (localDate) => {
        if (!localDate || isNaN(localDate.getTime())) return '';

        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const hours = String(localDate.getHours()).padStart(2, '0');
        const minutes = String(localDate.getMinutes()).padStart(2, '0');
        const seconds = String(localDate.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    formatDateForDisplay = (date) => {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    formatTimeForDisplay = (date) => {
        if (!date || isNaN(date.getTime())) return '08:00';
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    parseDateFromBackendUTC = (dateString) => {
        return this.parseDateFromBackendCorrectly(dateString);
    }

    UTCtoLocal = (utcDate) => {
        return utcDate;
    }

    calculateNewEventTime = (targetData) => {
        try {
            let newTime;

            if (targetData.date && targetData.hour !== undefined) {
                const [year, month, day] = targetData.date.split('-');
                const minute = targetData.minute !== undefined ? parseInt(targetData.minute) : 0;
                newTime = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(targetData.hour),
                    minute,
                    0
                );

            } else if ((targetData.physicianId || targetData.cabinId) && targetData.hour !== undefined) {
                newTime = new Date();
                const minute = targetData.minute !== undefined ? parseInt(targetData.minute) : 0;
                newTime.setHours(parseInt(targetData.hour), minute, 0, 0);
            } else {
                return new Date();
            }

            return newTime;
        } catch (error) {
            return new Date();
        }
    }

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

    getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    }

    getMinDate = () => {
        return new Date(2000, 0, 1).toISOString().split('T')[0];
    }

    getMaxDate = () => {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear.toISOString().split('T')[0];
    }

    generateHourOptions = () => {
        const hours = [];
        for (let hour = 0; hour < 24; hour++) {
            hours.push(String(hour).padStart(2, '0'));
        }
        return hours;
    }

    generateMinuteOptions = () => {
        return ['00', '30'];
    }

    getCurrentHour = (timeString) => {
        return timeString ? timeString.split(':')[0] : '00';
    }

    getCurrentMinute = (timeString) => {
        return timeString ? timeString.split(':')[1] : '00';
    }

    formatDuration = (hours) => {
        return Math.round(hours * 100) / 100;
    }
}
