/** @odoo-module **/

export const AppointmentFormValidation = {
    // Initialize validation state
    setupValidationState() {
        this.state = this.state || {};
        this.state.errors = {};
        this.state.validationErrors = {};
        this.state.serverError = null;
    },

    // Professional error notifications without field names
    showErrorNotification(title, error) {
        let errorMessage = this.getUserFriendlyErrorMessage(title, error);

        console.log('Showing error notification:', { title, errorMessage, originalError: error });

        this.notification.add(errorMessage, {
            type: 'danger',
            title: title || 'Operation Failed',
            sticky: true,
            className: 'appointment-error-notification'
        });
    },

    // Get user-friendly error messages
    getUserFriendlyErrorMessage(title, error) {
        // Default error message
        let errorMessage = "An unexpected error occurred. Please try again.";

        if (error && error.data) {
            // Handle Odoo validation errors
            if (error.data.name === 'odoo.exceptions.ValidationError') {
                errorMessage = this.extractValidationErrors(error.data.message);
            }
            // Handle access rights errors
            else if (error.data.name === 'odoo.exceptions.AccessError') {
                errorMessage = "You don't have permission to perform this action.";
            }
            // Handle other server errors with user-friendly messages
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
            'duration': 'Appointment duration'
        };

        errorLines.forEach(line => {
            if (line.includes(': ')) {
                const [field, message] = line.split(': ');
                const fieldName = field.trim();
                const errorMsg = message.trim();

                // Map technical field name to user-friendly label
                const fieldLabel = fieldMap[fieldName] || fieldName;

                // Format user-friendly error message
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
        // Common server errors with user-friendly messages
        const errorMappings = {
            'time slot is not available': 'The selected time slot is not available.',
            'physician is not available': 'The selected physician is not available at this time.',
            'cabin is not available': 'The consultation room is not available.',
            'invalid time range': 'Please check the appointment start and end times.',
            'patient already has appointment': 'Patient already has an appointment at this time.',
            'overlapping appointment': 'There is a scheduling conflict with another appointment.',
            'access denied': 'You don\'t have permission to perform this action.',
            'record does not exist': 'The requested information could not be found.'
        };

        const lowerMessage = serverMessage.toLowerCase();

        for (const [key, value] of Object.entries(errorMappings)) {
            if (lowerMessage.includes(key)) {
                return value;
            }
        }

        // Default formatted message
        return "A system error occurred. Please try again or contact support.";
    },

    async validateAppointmentConstraints(physicianId, date, hour, duration = 1, appointmentId = null) {
        console.log('=== بدء فحص القيود ===', {
            physicianId: physicianId,
            date: date,
            hour: hour,
            duration: duration,
            appointmentId: appointmentId
        });

        try {
            const breakCheck = await this.checkBreakPeriod(physicianId, date, hour, duration);
            if (breakCheck && breakCheck.isBreak) {
                this.showErrorNotification('Break Period', breakCheck.message);
                return false;
            }

            const startDate = new Date(date);
            startDate.setHours(hour, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, 0, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            console.log('Checking appointment overlap:', {
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

            if (overlapCheck && overlapCheck.hasOverlap) {
                const overlappingApps = overlapCheck.overlappingAppointments || [];
                const appNames = overlappingApps.map(app => app.name).join(', ');

                this.showErrorNotification('Appointment Conflict',
                    `الطبيب لديه موعد آخر في هذا الوقت: ${appNames}`);
                return false;
            }

            console.log('✅ جميع القيود مستوفاة');
            return true;
        } catch (error) {
            console.error('Error validating appointment constraints:', error);
            this.showErrorNotification('Validation Error', 'حدث خطأ أثناء التحقق من الموعد.');
            return false;
        }
    },

    async checkBreakPeriod(physicianId, date, hour, duration = 1) {
        try {
            const startDate = new Date(date);
            startDate.setHours(hour, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, 0, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            console.log('Checking break period:', {
                physicianId: physicianId,
                start: formattedStart,
                end: formattedEnd
            });

            const breakPeriods = await this.orm.call(
                'hms.physician',
                'get_break_periods_for_range',
                [physicianId, formattedStart.split(' ')[0], formattedEnd.split(' ')[0]]
            );

            // إذا وجدت فترات راحة، تحقق من التداخل
            if (breakPeriods && breakPeriods[physicianId]) {
                const breaks = breakPeriods[physicianId];
                for (const breakPeriod of breaks) {
                    const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                    const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                    console.log('Checking break:', {
                        breakStart: breakStart,
                        breakEnd: breakEnd,
                        appointmentStart: startDate,
                        appointmentEnd: endDate
                    });

                    if (startDate < breakEnd && endDate > breakStart) {
                        return {
                            isBreak: true,
                            breakPeriod: breakPeriod,
                            message: `الطبيب لديه فترة راحة من ${breakPeriod.start_time} إلى ${breakPeriod.end_time}.`
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking break period:', error);
            return null;
        }
    },

//    formatDateTimeForBackend(date) {
//        if (!date || isNaN(date.getTime())) return '';
//
//        const year = date.getFullYear();
//        const month = String(date.getMonth() + 1).padStart(2, '0');
//        const day = String(date.getDate()).padStart(2, '0');
//        const hours = String(date.getHours()).padStart(2, '0');
//        const minutes = String(date.getMinutes()).padStart(2, '0');
//        const seconds = String(date.getSeconds()).padStart(2, '0');
//
//        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
//    },

    // Enhanced validation with professional error messages
    validateForm() {
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

        return true;
    },

    // Enhanced save with professional error handling
    async saveAppointment() {
        try {
            this.state.loading = true;
            this.state.serverError = null;
            this.state.validationErrors = {};

            // Client-side validation
            if (!this.validateForm()) {
                this.state.loading = false;
                return;
            }

            // التحقق من القيود (فترات الراحة والتداخل) - مطلوب فقط للطبيب
            if (this.state.physician_id && this.state.tempDate && this.state.tempStartTime) {
                // حساب الساعة والمدة
                const startTimeParts = this.state.tempStartTime.split(':');
                const hour = parseInt(startTimeParts[0]);
                const duration = this.state.duration || 1;

                console.log('Validating constraints before save:', {
                    physicianId: this.state.physician_id,
                    date: this.state.tempDate,
                    hour: hour,
                    duration: duration,
                    appointmentId: this.props.mode === 'edit' ? this.props.appointmentId : null
                });

                const isValid = await this.validateAppointmentConstraints(
                    this.state.physician_id,
                    this.state.tempDate,
                    hour,
                    duration,
                    this.props.mode === 'edit' ? this.props.appointmentId : null
                );

                if (!isValid) {
                    this.state.loading = false;
                    return;
                }
            }

            // Prepare appointment data
            const appointmentData = {
                patient_id: this.state.patient_id,
                physician_id: this.state.physician_id,
                department_id: this.state.department_id,
                cabin_id: this.state.cabin_id,
                product_id: this.state.product_id,
                date: this.state.date,
                date_to: this.state.date_to,
                consultation_type: this.state.consultation_type,
                state: this.state.state
            };

            console.log('Saving appointment data:', appointmentData);

            let result;
            if (this.props.mode === 'create') {
                result = await this.orm.create('hms.appointment', [appointmentData]);

                this.notification.add('تم إنشاء الموعد بنجاح', {
                    type: 'success',
                    title: 'تم إنشاء الموعد',
                    className: 'appointment-success-notification'
                });
            } else {
                result = await this.orm.write('hms.appointment', [this.props.appointmentId], appointmentData);

                this.notification.add('تم تحديث الموعد بنجاح', {
                    type: 'success',
                    title: 'تم تحديث الموعد',
                    className: 'appointment-success-notification'
                });
            }

            if (result) {
                this.props.onSave();
                this.props.close();
            }

        } catch (error) {
            console.error('Error saving appointment:', error);
            this.showErrorNotification('تعذر حفظ الموعد', error);
            this.state.serverError = error;
        } finally {
            this.state.loading = false;
        }
    },

    // Clear error for specific field
    clearError(fieldName) {
        if (this.state.errors[fieldName]) {
            const newErrors = { ...this.state.errors };
            delete newErrors[fieldName];
            this.state.errors = newErrors;
        }

        // Also clear validation errors
        if (this.state.validationErrors[fieldName]) {
            const newValidationErrors = { ...this.state.validationErrors };
            delete newValidationErrors[fieldName];
            this.state.validationErrors = newValidationErrors;
        }

        // Clear server error when user starts fixing fields
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
    }
};