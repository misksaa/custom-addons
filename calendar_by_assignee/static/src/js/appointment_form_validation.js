/** @odoo-module **/

export const AppointmentFormValidation = {

    // Initialize validation state
    setupValidationState() {
        this.state = this.state || {};
        this.state.errors = {};
        this.state.validationErrors = {};
        this.state.serverError = null;
    },

    // // Professional error notifications
    // showErrorNotification(title, error) {
    //     let errorMessage = this.getUserFriendlyErrorMessage(title, error);
    //
    //     this.notification.add(errorMessage, {
    //         type: 'danger',
    //         title: title || 'Operation Failed',
    //         sticky: true,
    //         className: 'appointment-error-notification'
    //     });
    // },

    // // Show success notification
    // showSuccessNotification(message) {
    //     this.notification.add(message, {
    //         type: 'success',
    //         title: 'Success',
    //         className: 'appointment-success-notification'
    //     });
    // },

    // // Show warning notification
    // showWarningNotification(message) {
    //     this.notification.add(message, {
    //         type: 'warning',
    //         title: 'Validation Warning',
    //         sticky: true,
    //         className: 'appointment-warning-notification'
    //     });
    // },

    // Get user-friendly error messages
    getUserFriendlyErrorMessage(title, error) {
        let errorMessage = "An unexpected error occurred. Please try again.";

        if (error && error.data) {
            if (error.data.name === 'odoo.exceptions.ValidationError') {
                errorMessage = this.extractValidationErrors(error.data.message);
            }
            else if (error.data.name === 'odoo.exceptions.AccessError') {
                errorMessage = "You don't have permission to perform this action.";
            }
            else if (error.data.message) {
                errorMessage = this.formatServerErrorMessage(error.data.message);
            }
        } else if (error && error.message) {
            errorMessage = this.formatServerErrorMessage(error.message);
        } else if (typeof error === 'string') {
            errorMessage = error;
        }

        return errorMessage;
    },

    // Extract and format validation errors
    extractValidationErrors(validationError) {
        const errorLines = validationError.split('\n');
        const errorMessages = [];
        const fieldMap = {
            'patient_id': 'Patient selection',
            'physician_id': 'Physician selection',
            'cabin_id': 'Consultation room selection',
            'product_id': 'Service selection',
            'date': 'Appointment date',
            'date_to': 'Appointment end time',
            'duration': 'Appointment duration',
            'notes': 'Notes'  // Added notes mapping
        };

        errorLines.forEach(line => {
            if (line.includes(': ')) {
                const [field, message] = line.split(': ');
                const fieldName = field.trim();
                const errorMsg = message.trim();

                const fieldLabel = fieldMap[fieldName] || fieldName;

                let formattedMessage = '';

                if (errorMsg.includes('Missing required')) {
                    formattedMessage = `${fieldLabel} is required.`;
                } else if (errorMsg.includes('Invalid value')) {
                    formattedMessage = `Please check the ${fieldLabel.toLowerCase()} value.`;
                } else if (errorMsg.includes('already exists')) {
                    formattedMessage = `${fieldLabel} conflict detected.`;
                } else if (errorMsg.includes('not found')) {
                    formattedMessage = `${fieldLabel} not found.`;
                } else if (errorMsg.includes('overlap') || errorMsg.includes('conflict')) {
                    formattedMessage = `Time slot conflict detected for ${fieldLabel.toLowerCase()}.`;
                } else {
                    formattedMessage = `Issue with ${fieldLabel.toLowerCase()}: ${errorMsg}`;
                }

                errorMessages.push(formattedMessage);
            }
        });

        if (errorMessages.length > 0) {
            if (errorMessages.length === 1) {
                return errorMessages[0];
            } else {
                return "Multiple issues detected:\n• " + errorMessages.join("\n• ");
            }
        }

        return "Please check the entered information for any issues.";
    },

    // Format server error messages
    formatServerErrorMessage(serverMessage) {
        const errorMappings = {
            'time slot is not available': 'The selected time slot is not available.',
            'physician is not available': 'The selected physician is not available at this time.',
            'cabin is not available': 'The consultation room is not available.',
            'invalid time range': 'Please check the appointment start and end times.',
            'patient already has appointment': 'Patient already has an appointment at this time.',
            'overlapping appointment': 'There is a scheduling conflict with another appointment.',
            'access denied': 'You don\'t have permission to perform this action.',
            'record does not exist': 'The requested information could not be found.',
            'break period': 'Cannot schedule during break period.',
            'leave period': 'Cannot schedule during leave period.',
            'gender conflict': 'Gender conflict in consultation room.',
            'cabin conflict': 'Consultation room already occupied.',
            'notes': 'Error saving notes.'  // Added notes error
        };

        const lowerMessage = serverMessage.toLowerCase();

        for (const [key, value] of Object.entries(errorMappings)) {
            if (lowerMessage.includes(key)) {
                return value;
            }
        }

        return "A system error occurred. Please try again or contact support.";
    },

    // Helper method to format date only (without time)
    formatDateOnlyForBackend(date) {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    },

    // Professional error notifications
    showErrorNotification(message, title = 'Operation Failed') {
        console.log('📝 LOG: showErrorNotification:', message);
        this.notification.add(message, {
            type: 'danger',
            title: title,
            sticky: true,
            className: 'appointment-error-notification'
        });
    },

    // Show success notification
    showSuccessNotification(message, title = 'Success') {
        console.log('✅ LOG: showSuccessNotification:', message);
        this.notification.add(message, {
            type: 'success',
            title: title,
            className: 'appointment-success-notification'
        });
    },

    // Show warning notification
    showWarningNotification(message, title = 'Validation Warning') {
        console.log('⚠️ LOG: showWarningNotification:', message);
        this.notification.add(message, {
            type: 'warning',
            title: title,
            sticky: true,
            className: 'appointment-warning-notification'
        });
    },

    async validateAllConstraints(physicianId, cabinId, date, hour, duration = 1, appointmentId = null, patientGender = null) {
        console.log('=== Starting comprehensive constraint validation ===', {
            physicianId: physicianId,
            cabinId: cabinId,
            date: date,
            hour: hour,
            duration: duration,
            appointmentId: appointmentId,
            patientGender: patientGender
        });

        try {
            physicianId = parseInt(physicianId);
            cabinId = parseInt(cabinId);

            // 1. Check physician break period (including leaves)
            const physicianBreakCheck = await this.checkPhysicianBreakPeriod(physicianId, date, hour, duration);
            if (physicianBreakCheck && physicianBreakCheck.isBreak) {
                let message = '';
                if (physicianBreakCheck.isLeave) {
                    message = `Cannot schedule: Physician is on leave (${physicianBreakCheck.leaveName}) from ${physicianBreakCheck.start} to ${physicianBreakCheck.end}.`;
                } else {
                    message = `Cannot schedule: Physician has a break period from ${physicianBreakCheck.start} to ${physicianBreakCheck.end}.`;
                }

                this.showErrorNotification(message, 'Physician Unavailable');
                return false;
            }

            // 2. Check physician appointment overlap
            const physicianOverlapCheck = await this.checkPhysicianAppointmentOverlap(physicianId, date, hour, duration, appointmentId);
            if (physicianOverlapCheck && physicianOverlapCheck.hasOverlap) {
                let message = 'Cannot schedule: Physician has another appointment at this time.';

                if (physicianOverlapCheck.overlappingAppointments && physicianOverlapCheck.overlappingAppointments.length > 0) {
                    const appointments = physicianOverlapCheck.overlappingAppointments.map(app =>
                        `${app.name} (${app.patient_id || 'Unknown patient'})`
                    ).join(', ');
                    message = `Cannot schedule: Physician has overlapping appointments: ${appointments}`;
                }

                this.showErrorNotification(message, 'Physician Schedule Conflict');
                return false;
            }

            // 3. Check cabin break period
            const cabinBreakCheck = await this.checkCabinBreakPeriod(cabinId, date, hour, duration);
            if (cabinBreakCheck && cabinBreakCheck.isBreak) {
                const message = `Cannot schedule: Cabin has a break period from ${cabinBreakCheck.start} to ${cabinBreakCheck.end}.`;
                this.showErrorNotification(message, 'Cabin Unavailable');
                return false;
            }

            // 4. Check cabin appointment conflicts with gender validation
            const cabinConflictCheck = await this.checkCabinAppointmentConflict(cabinId, date, hour, duration, patientGender, appointmentId);
            if (cabinConflictCheck && cabinConflictCheck.hasConflict) {
                if (cabinConflictCheck.genderConflict) {
                    const message = cabinConflictCheck.detailedMessage || `Cannot schedule: Gender conflict in consultation room.`;
                    this.showErrorNotification(message, 'Gender Conflict');
                } else {
                    const message = cabinConflictCheck.detailedMessage || `Cannot schedule: Cabin already has an appointment at this time.`;
                    this.showErrorNotification(message, 'Cabin Occupied');
                }
                return false;
            }

            console.log('✅ All constraints satisfied');
            return true;
        } catch (error) {
            console.error('Error validating constraints:', error);
            this.showErrorNotification('Error occurred while checking appointment constraints.', 'Validation Error');
            return false;
        }
    },

    // Check physician break period (including leaves)
    async checkPhysicianBreakPeriod(physicianId, date, hour, duration = 1) {
        try {
            if (!physicianId) return null;

            const startDate = new Date(date);
            startDate.setHours(hour, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, 0, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            console.log('Checking physician break period:', {
                physicianId: physicianId,
                start: formattedStart,
                end: formattedEnd
            });

            const breakPeriods = await this.orm.call(
                'hms.physician',
                'get_break_periods_for_range',
                [physicianId, this.formatDateOnlyForBackend(startDate), this.formatDateOnlyForBackend(endDate)]
            );

            if (breakPeriods && breakPeriods[physicianId]) {
                const breaks = breakPeriods[physicianId];
                for (const breakPeriod of breaks) {
                    try {
                        const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                        const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                        console.log('Checking physician break/leave:', {
                            breakStart: breakStart,
                            breakEnd: breakEnd,
                            appointmentStart: startDate,
                            appointmentEnd: endDate
                        });

                        if (startDate < breakEnd && endDate > breakStart) {
                            return {
                                isBreak: true,
                                isLeave: breakPeriod.type === 'leave',
                                leaveName: breakPeriod.leave_name || 'Leave',
                                start: breakPeriod.start_time,
                                end: breakPeriod.end_time,
                                type: breakPeriod.type || 'break'
                            };
                        }
                    } catch (e) {
                        console.error('Error checking break period:', e);
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking physician break period:', error);
            return null;
        }
    },

    // Check physician appointment overlap
    async checkPhysicianAppointmentOverlap(physicianId, date, hour, duration = 1, appointmentId = null) {
        try {
            physicianId = parseInt(physicianId);
            if (isNaN(physicianId)) {
                console.error('Invalid physicianId for overlap check:', physicianId);
                return null;
            }

            const startDate = new Date(date);
            startDate.setHours(hour, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, 0, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            console.log('FIXED FORM: Checking physician appointment overlap:', {
                physicianId: physicianId,
                start: formattedStart,
                end: formattedEnd,
                appointmentId: appointmentId
            });

            const overlapCheck = await this.orm.call(
                'hms.appointment',
                'check_appointment_overlap',
                [physicianId, formattedStart, formattedEnd, appointmentId]
            );

            return overlapCheck;
        } catch (error) {
            console.error('Error checking physician appointment overlap:', error);
            return null;
        }
    },

    // Check cabin break period
    async checkCabinBreakPeriod(cabinId, date, hour, duration = 1) {
        try {
            cabinId = parseInt(cabinId);
            if (isNaN(cabinId)) {
                console.error('Invalid cabinId for break check:', cabinId);
                return null;
            }

            const startDate = new Date(date);
            startDate.setHours(hour, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, 0, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            console.log('Checking cabin break period:', {
                cabinId: cabinId,
                start: formattedStart,
                end: formattedEnd
            });

            const breakPeriods = await this.orm.call(
                'appointment.cabin',
                'get_cabin_break_periods_for_range',
                [cabinId, this.formatDateOnlyForBackend(startDate), this.formatDateOnlyForBackend(endDate)]
            );

            if (breakPeriods && breakPeriods[cabinId]) {
                const breaks = breakPeriods[cabinId];
                for (const breakPeriod of breaks) {
                    try {
                        const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                        const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                        console.log('Checking cabin break:', {
                            breakStart: breakStart,
                            breakEnd: breakEnd,
                            appointmentStart: startDate,
                            appointmentEnd: endDate
                        });

                        if (startDate < breakEnd && endDate > breakStart) {
                            return {
                                isBreak: true,
                                start: breakPeriod.start_time,
                                end: breakPeriod.end_time
                            };
                        }
                    } catch (e) {
                        console.error('Error checking cabin break:', e);
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking cabin break period:', error);
            return null;
        }
    },

    // FIXED: Check cabin appointment conflicts with gender validation
    async checkCabinAppointmentConflict(cabinId, date, hour, duration = 1, patientGender = null, appointmentId = null) {
        try {
            cabinId = parseInt(cabinId);
            if (isNaN(cabinId)) {
                console.error('Invalid cabinId for conflict check:', cabinId);
                return {
                    hasConflict: false,
                    genderConflict: false,
                    message: 'Invalid cabin selected.',
                    detailedMessage: 'Please select a valid consultation room.'
                };
            }

            console.log('FIXED FORM: Checking cabin appointment conflict with:', {
                cabinId: cabinId,
                date: date,
                hour: hour,
                duration: duration,
                patientGender: patientGender,
                appointmentId: appointmentId
            });

            const startDate = new Date(date);
            startDate.setHours(hour, 0, 0, 0);

            const endDate = new Date(startDate);
            const durationMinutes = Math.round(duration * 60);
            endDate.setMinutes(endDate.getMinutes() + durationMinutes);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            console.log('FIXED FORM: Formatted parameters for backend:', {
                cabin_id: cabinId,
                start_datetime: formattedStart,
                end_datetime: formattedEnd,
                patient_gender: patientGender,
                exclude_appointment_id: appointmentId
            });

            const conflictCheck = await this.orm.call(
                'hms.appointment',
                'check_cabin_appointment_conflict',
                [cabinId, formattedStart, formattedEnd, patientGender || false, appointmentId || false]
            );

            console.log('FIXED FORM: Cabin appointment conflict check result:', conflictCheck);
            return conflictCheck;

        } catch (error) {
            console.error('FIXED FORM: Error checking cabin appointment conflict:', error);
            return {
                hasConflict: false,
                genderConflict: false,
                message: 'Error checking cabin conflict',
                detailedMessage: `System error: ${error.message}`
            };
        }
    },

    formatDateTimeForBackend(date) {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },

    validateForm() {
        console.log('🔍 LOG: Validating form, notes value:', this.state.notes);
        const errors = {};
        const errorMessages = [];

        // Required field validation with user-friendly messages
        if (!this.state.patient_id) {
            errors.patient_id = 'Patient selection is required';
            errorMessages.push("• Please select a patient");
        }
        if (!this.state.physician_id) {
            errors.physician_id = 'Physician selection is required';
            errorMessages.push("• Please select a physician");
        }
        if (!this.state.product_id) {
            errors.product_id = 'Service selection is required';
            errorMessages.push("• Please select a consultation service");
        }
        if (!this.state.cabin_id) {
            errors.cabin_id = 'Room selection is required';
            errorMessages.push("• Please select a consultation room");
        }
        if (!this.state.tempDate) {
            errors.tempDate = 'Date selection is required';
            errorMessages.push("• Please select an appointment date");
        }
        if (!this.state.tempStartTime) {
            errors.tempStartTime = 'Start time is required';
            errorMessages.push("• Please enter a start time");
        }
        if (!this.state.tempEndTime) {
            errors.tempEndTime = 'End time is required';
            errorMessages.push("• Please enter an end time");
        }

        // Validation for treatment schedule fields
        if (this.state.consultation_type === 'treatment_schedule') {
            if (!this.state.selected_treatment_schedule_id) {
                errors.selected_treatment_schedule_id = 'Treatment Schedule is required';
                errorMessages.push("• Please select a Treatment Schedule");
            }
            if (!this.state.selected_session_type_id) {
                errors.selected_session_type_id = 'Session Type is required';
                errorMessages.push("• Please select a Session Type");
            }
            if (!this.state.selected_week) {
                errors.selected_week = 'Week selection is required';
                errorMessages.push("• Please select a Week");
            }

        }

        // Time format and logic validation
        if (this.state.tempStartTime && this.state.tempEndTime) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

            if (!timeRegex.test(this.state.tempStartTime)) {
                errors.tempStartTime = 'Invalid time format';
                errorMessages.push("• Start time format should be HH:MM (24-hour format)");
            }

            if (!timeRegex.test(this.state.tempEndTime)) {
                errors.tempEndTime = 'Invalid time format';
                errorMessages.push("• End time format should be HH:MM (24-hour format)");
            }

            if (timeRegex.test(this.state.tempStartTime) && timeRegex.test(this.state.tempEndTime)) {
                const [startHours, startMinutes] = this.state.tempStartTime.split(':');
                const [endHours, endMinutes] = this.state.tempEndTime.split(':');

                const startTotalMinutes = parseInt(startHours) * 60 + parseInt(startMinutes);
                const endTotalMinutes = parseInt(endHours) * 60 + parseInt(endMinutes);

                if (endTotalMinutes <= startTotalMinutes) {
                    errors.tempEndTime = 'End time must be after start time';
                    errorMessages.push("• End time must be after start time");
                }
            }
        }

        // Notes validation (optional but add to errors if there's an issue)
        if (this.state.notes && this.state.notes.length > 1000) {
            errors.notes = 'Notes are too long (maximum 1000 characters)';
            errorMessages.push("• Notes are too long (maximum 1000 characters)");
        }

        this.state.errors = errors;

        // Show all validation errors in a professional notification
        if (errorMessages.length > 0) {
            let notificationMessage = "Please correct the following:\n";
            notificationMessage += errorMessages.join("\n");

            this.notification.add(notificationMessage, {
                type: 'warning',
                title: 'Validation Required',
                sticky: true,
                className: 'appointment-validation-notification'
            });

            return false;
        }

        console.log('✅ LOG: Form validation passed');
        return true;
    },

    // Get patient gender from selected patient info
    getPatientGender() {
        if (this.state.selectedPatientInfo) {
            const genderText = this.state.selectedPatientInfo.gender || '';
            if (genderText.includes('Male')) return 'male';
            if (genderText.includes('Female')) return 'female';
        }

        if (this.state.patient_gender) {
            return this.state.patient_gender;
        }

        return null;
    },

    // Enhanced save with comprehensive validation
    async saveAppointment() {
        try {
            console.log('🔍 LOG: Starting saveAppointment process');
            console.log('📝 LOG: Current notes value before save:', this.state.notes);

            this.state.loading = true;
            this.state.serverError = null;
            this.state.validationErrors = {};

            if (!this.validateForm()) {
                console.log('❌ LOG: Form validation failed');
                this.state.loading = false;
                return;
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

            console.log('Validating all constraints before save:', {
                physicianId: physicianId,
                cabinId: cabinId,
                date: this.state.tempDate,
                hour: hour,
                duration: duration,
                appointmentId: this.props.mode === 'edit' ? this.props.appointmentId : null,
                patientGender: patientGender
            });

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

            // Prepare appointment data WITH NOTES
            const appointmentData = {
                patient_id: patientId,
                physician_id: physicianId,
                cabin_id: cabinId,
                product_id: productId,
                date: this.state.date,
                date_to: this.state.date_to,
                consultation_type: this.state.consultation_type,
                state: this.state.state,
                notes: this.state.notes || ''  // IMPORTANT: Include notes field
            };

            console.log('✅ LOG: Saving appointment data with notes:', appointmentData);

            // Add treatment schedule fields if applicable
            if (this.state.consultation_type === 'treatment_schedule' && this.state.selected_treatment_schedule_id) {
                appointmentData.treatment_schedule_id = this.state.selected_treatment_schedule_id;
            }

            let result;
            if (this.props.mode === 'create') {
                console.log('🔍 LOG: Creating new appointment with notes');
                result = await this.orm.create('hms.appointment', [appointmentData]);
                this.showSuccessNotification('Appointment created successfully');
            } else {
                console.log('🔍 LOG: Updating existing appointment with notes');
                result = await this.orm.write('hms.appointment', [this.props.appointmentId], appointmentData);
                this.showSuccessNotification('Appointment updated successfully');
            }

            if (result) {
                // Create/Update treatment schedule line if needed
                if (this.state.consultation_type === 'treatment_schedule') {
                    const lineCreated = await this.createTreatmentScheduleLine();
                    if (lineCreated) {
                        this.showSuccessNotification('Treatment schedule updated successfully');
                    }
                }

                console.log('✅ LOG: Appointment saved successfully with notes:', this.state.notes);
                setTimeout(() => {
                    this.props.onSave();
                    this.props.close();
                }, 100);
            }

        } catch (error) {
            console.error('❌ LOG: Error saving appointment:', error);

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
    },

    // Create treatment schedule line
    async createTreatmentScheduleLine() {
        try {
            if (!this.state.selected_treatment_schedule_id ||
                !this.state.selected_session_type_id ||
                !this.state.selected_week) {
                console.warn('Missing required fields for treatment schedule line');
                return false;
            }

            const weekFieldMap = {
                1: { date: 'wk1_date', number: 'wk1_number' },
                2: { date: 'wk2_date', number: 'wk2_number' },
                3: { date: 'wk3_date', number: 'wk3_number' },
                4: { date: 'wk4_date', number: 'wk4_number' },
                5: { date: 'wk5_date', number: 'wk5_number' },
                6: { date: 'wk6_date', number: 'wk6_number' },
                7: { date: 'wk7_date', number: 'wk7_number' },
                8: { date: 'wk8_date', number: 'wk8_number' }
            };

            const weekFields = weekFieldMap[this.state.selected_week];
            if (!weekFields) {
                throw new Error(`Invalid week number: ${this.state.selected_week}`);
            }

            let existingLine = null;
            for (const line of this.state.treatment_schedule_lines) {
                if (line.product_id && line.product_id[0] === this.state.selected_session_type_id) {
                    existingLine = line;
                    break;
                }
            }

            const lineData = {
                'schedule_id': this.state.selected_treatment_schedule_id,
                'product_id': this.state.selected_session_type_id,
                [weekFields.date]: this.state.week_date,
                [weekFields.number]: this.state.week_number
            };

            let result;
            if (existingLine) {
                result = await this.orm.write(
                    'hms.treatment.schedule.line',
                    [existingLine.id],
                    lineData
                );
                console.log('Updated treatment schedule line:', result);
            } else {
                result = await this.orm.create(
                    'hms.treatment.schedule.line',
                    [lineData]
                );
                console.log('Created treatment schedule line:', result);
            }

            return true;
        } catch (error) {
            console.error('Error creating/updating treatment schedule line:', error);
            this.showErrorNotification('Error saving treatment schedule details', error);
            return false;
        }
    },

    // Clear error for specific field
    clearError(fieldName) {
        if (this.state.errors[fieldName]) {
            const newErrors = { ...this.state.errors };
            delete newErrors[fieldName];
            this.state.errors = newErrors;
        }

        if (this.state.validationErrors[fieldName]) {
            const newValidationErrors = { ...this.state.validationErrors };
            delete newValidationErrors[fieldName];
            this.state.validationErrors = newValidationErrors;
        }

        this.state.serverError = null;
    },

    // Get error class for field
    getFieldErrorClass(fieldName) {
        return this.state.errors[fieldName] || this.state.validationErrors[fieldName] ? 'is-invalid' : '';
    },

    // Get error message for field
    getFieldError(fieldName) {
        return this.state.validationErrors[fieldName] || this.state.errors[fieldName] || '';
    },

    // Check if field has validation error from server
    hasServerValidationError(fieldName) {
        return !!this.state.validationErrors[fieldName];
    },

    async validateDragAndDropConstraints(targetData, draggedEvent) {
        console.log('=== START: Validating drag and drop constraints ===', {
            targetData: targetData,
            draggedEvent: draggedEvent
        });

        try {
            const patientGender = draggedEvent.patient_gender || null;
            const appointmentId = draggedEvent.id;
            const physicianId = targetData.physicianId || draggedEvent.doctor_id;
            let cabinId = targetData.cabinId || draggedEvent.cabin_id;

            console.log('DEBUG - Raw cabinId:', cabinId, 'type:', typeof cabinId);

            if (cabinId) {
                cabinId = parseInt(cabinId);
            }

            if (!cabinId || isNaN(cabinId)) {
                console.error('Invalid cabinId:', cabinId);
                return {
                    isValid: false,
                    message: 'Invalid cabin selected.'
                };
            }

            const eventStart = this.parseDateFromBackend(draggedEvent.start);
            const eventEnd = this.parseDateFromBackend(draggedEvent.stop);
            const durationMs = eventEnd.getTime() - eventStart.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            const targetDate = targetData.date || this.formatDateForBackend(this.state.currentDate);
            const targetHour = targetData.hour || 0;
            const targetMinute = targetData.minute || 0;

            console.log('DEBUG - Validation parameters:', {
                cabinId: cabinId,
                targetDate: targetDate,
                targetHour: targetHour,
                targetMinute: targetMinute,
                durationHours: durationHours,
                patientGender: patientGender,
                appointmentId: appointmentId
            });

            if (cabinId && patientGender) {
                const startDate = new Date(targetDate);
                startDate.setHours(targetHour, targetMinute, 0, 0);
                const endDate = new Date(startDate);

                const durationMinutes = Math.round(durationHours * 60);
                endDate.setMinutes(endDate.getMinutes() + durationMinutes);

                const formattedStart = this.formatDateTimeForBackend(startDate);
                const formattedEnd = this.formatDateTimeForBackend(endDate);

                console.log('DEBUG - Dates for conflict check:', {
                    startDate: startDate,
                    endDate: endDate,
                    formattedStart: formattedStart,
                    formattedEnd: formattedEnd,
                    durationMinutes: durationMinutes
                });

                console.log('DEBUG - Calling cabin conflict check with FIXED parameters:', {
                    cabinId: cabinId,
                    start: formattedStart,
                    end: formattedEnd,
                    patientGender: patientGender,
                    appointmentId: appointmentId
                });

                const conflictCheck = await this.orm.call(
                    'hms.appointment',
                    'check_cabin_appointment_conflict',
                    [cabinId, formattedStart, formattedEnd, patientGender, appointmentId]
                );

                console.log('DEBUG - Cabin conflict check result:', conflictCheck);

                if (conflictCheck && conflictCheck.hasConflict) {
                    if (conflictCheck.genderConflict) {
                        return {
                            isValid: false,
                            message: `Cannot move: Cabin already has an appointment with a ${conflictCheck.conflictingGender} patient.`
                        };
                    } else {
                        return {
                            isValid: false,
                            message: `Cannot move: Cabin already has an appointment at this time.`
                        };
                    }
                }
            }

            if (physicianId && targetData.physicianId && targetData.physicianId !== draggedEvent.doctor_id) {
                const physicianBreakCheck = await this.checkPhysicianBreakPeriodForDrop(
                    targetData.physicianId,
                    targetDate,
                    targetHour,
                    targetMinute,
                    durationHours
                );

                if (physicianBreakCheck) {
                    if (physicianBreakCheck.isLeave) {
                        return {
                            isValid: false,
                            message: `Cannot move: Physician is on leave (${physicianBreakCheck.leaveName}).`
                        };
                    } else {
                        return {
                            isValid: false,
                            message: `Cannot move: Physician has a break period.`
                        };
                    }
                }
            }


            if (cabinId && targetData.cabinId && targetData.cabinId !== draggedEvent.cabin_id) {
                const cabinBreakCheck = await this.checkCabinBreakPeriodForDrop(
                    targetData.cabinId,
                    targetDate,
                    targetHour,
                    targetMinute,
                    durationHours
                );

                if (cabinBreakCheck) {
                    return {
                        isValid: false,
                        message: `Cannot move: Cabin has a break period.`
                    };
                }
            }

            console.log('✅ All drag and drop constraints satisfied');
            return {
                isValid: true,
                message: 'Validation passed'
            };

        } catch (error) {
            console.error('❌ Error validating drag and drop constraints:', error);
            return {
                isValid: false,
                message: 'Error occurred while validating drag and drop.'
            };
        }
    },

    // Check physician break period for drag and drop
    async checkPhysicianBreakPeriodForDrop(physicianId, date, hour, minute, duration) {
        try {
            const startDate = new Date(date);
            startDate.setHours(hour, minute, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, minute, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            const breakPeriods = await this.orm.call(
                'hms.physician',
                'get_break_periods_for_range',
                [physicianId, this.formatDateOnlyForBackend(startDate), this.formatDateOnlyForBackend(endDate)]
            );

            if (breakPeriods && breakPeriods[physicianId]) {
                const breaks = breakPeriods[physicianId];
                for (const breakPeriod of breaks) {
                    const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                    const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                    if (startDate < breakEnd && endDate > breakStart) {
                        return {
                            isLeave: breakPeriod.type === 'leave',
                            leaveName: breakPeriod.leave_name || '',
                            start: breakPeriod.start_time,
                            end: breakPeriod.end_time
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking physician break period for drop:', error);
            return null;
        }
    },

    // Check cabin break period for drag and drop
    async checkCabinBreakPeriodForDrop(cabinId, date, hour, minute, duration) {
        try {
            const startDate = new Date(date);
            startDate.setHours(hour, minute, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, minute, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            const breakPeriods = await this.orm.call(
                'appointment.cabin',
                'get_cabin_break_periods_for_range',
                [cabinId, this.formatDateOnlyForBackend(startDate), this.formatDateOnlyForBackend(endDate)]
            );

            if (breakPeriods && breakPeriods[cabinId]) {
                const breaks = breakPeriods[cabinId];
                for (const breakPeriod of breaks) {
                    const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                    const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                    if (startDate < breakEnd && endDate > breakStart) {
                        return {
                            start: breakPeriod.start_time,
                            end: breakPeriod.end_time
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking cabin break period for drop:', error);
            return null;
        }
    },

    parseDateFromBackend(dateString) {
        if (!dateString) return new Date();

        try {
            let date;
            if (dateString.includes('T')) {
                date = new Date(dateString);
            } else {
                const [datePart, timePart] = dateString.split(' ');
                const [year, month, day] = datePart.split('-');
                const [hours, minutes, seconds] = timePart ? timePart.split(':') : ['00', '00', '00'];

                date = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
            }

            return date;
        } catch (error) {
            console.error('Error parsing date:', error, dateString);
            return new Date();
        }
    },

    formatDateForBackend(date) {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return year + '-' + month + '-' + day;
    }

};