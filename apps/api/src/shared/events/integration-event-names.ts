/** Valores del campo `type` de DomainEvent. Formato: <agregado>.<hecho en pasado>. */
export const INTEGRATION_EVENTS = {
  PATIENT_REGISTERED: 'patient.registered',
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_ATTENDED: 'appointment.attended',
  BED_ASSIGNED: 'bed.assigned',
  BED_RELEASED: 'bed.released',
  BED_CLEANED: 'bed.cleaned',
  PATIENT_ADMITTED: 'patient.admitted',
  MEDICATION_ADMINISTERED: 'medication.administered',
  VITAL_SIGN_ALERT: 'vital-sign.alert-raised',
  ADMISSIONS_APPOINTMENT_ATTENDED: 'admissions.appointment-attended',
  PATIENT_WAITING: 'admissions.patient-waiting',
  STANDBY_PROMOTED: 'admissions.standby-promoted',
} as const;