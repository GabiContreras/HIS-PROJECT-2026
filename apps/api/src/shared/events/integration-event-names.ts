/** Valores del campo `type` de DomainEvent. Formato: <agregado>.<hecho en pasado>. */
export const INTEGRATION_EVENTS = {
  PATIENT_REGISTERED: 'patient.registered',
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_ATTENDED: 'appointment.attended',
  BED_ASSIGNED: 'bed.assigned',
  PATIENT_ADMITTED: 'patient.admitted',
  MEDICATION_ADMINISTERED: 'medication.administered',
  VITAL_SIGN_ALERT: 'vital-sign.alert-raised',
} as const;