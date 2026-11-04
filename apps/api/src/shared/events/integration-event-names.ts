/** Valores del campo `type` de DomainEvent. Formato: <agregado>.<hecho en pasado>. */
export const INTEGRATION_EVENTS = {
  PATIENT_REGISTERED: 'patient.registered',
  APPOINTMENT_BOOKED: 'appointment.booked',
  APPOINTMENT_ATTENDED: 'appointment.attended',
  BED_ASSIGNED: 'bed.assigned',
  BED_RELEASED: 'bed.released',
  BED_CLEANED: 'bed.cleaned',
  MEDICATION_ADMINISTERED: 'medication.administered',
} as const;