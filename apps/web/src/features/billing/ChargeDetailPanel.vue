<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue';
import SideDrawer from '../../components/ui/SideDrawer.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import type { Charge } from '../../services/charges';
import { formatDateTime, formatDocument, formatMoney } from '../../shared/format';
import { COBERTURA_LABEL, CONCEPTO, coverageLabel, doctorName, initials, patientName, thirdPartyLabel, TIPO_LABEL } from './charge-ui';

defineProps<{ open: boolean; charge: Charge | null }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <SideDrawer :open="open" title="Detalle del cargo" subtitle="Facturación" @close="emit('close')">
    <template #icon><AppIcon name="calendar" :size="22" /></template>

    <div v-if="charge" class="detail">
      <section class="summary">
        <span class="eyebrow">Valor base de la prestación</span>
        <strong class="amount">{{ formatMoney(charge.importePesos) }}</strong>
        <div class="divider"></div>
        <div class="meta">
          <div><span>Concepto facturado</span><strong>{{ CONCEPTO[charge.tipoAtencion] }}</strong></div>
          <StatusChip
            :label="TIPO_LABEL[charge.tipoAtencion]"
            :tone="charge.tipoAtencion === 'URGENCIA' ? 'warning' : 'info'"
          />
        </div>
      </section>

      <section class="block">
        <h3>Origen del cargo</h3>
        <dl class="grid">
          <div><dt>Prestación</dt><dd>{{ CONCEPTO[charge.tipoAtencion] }}</dd></div>
          <div>
            <dt>Turno asociado</dt>
            <dd v-if="charge.turno">
              {{ formatDateTime(charge.turno.fechaHora) }} · {{ charge.turno.duracionMinutos }} min
            </dd>
            <dd v-else class="quiet">No disponible</dd>
          </div>
          <div><dt>Médico</dt><dd :class="{ quiet: !charge.turno }">{{ doctorName(charge) }}</dd></div>
          <div><dt>ID del turno</dt><dd><code>{{ charge.turnoId }}</code></dd></div>
        </dl>
      </section>

      <section class="block">
        <h3>Paciente y cobertura</h3>
        <div class="patient">
          <span class="avatar">{{ initials(charge) }}</span>
          <div>
            <strong>{{ patientName(charge) }}</strong>
            <span v-if="charge.turno?.paciente">DNI {{ formatDocument(charge.turno.paciente.documento) }}</span>
          </div>
        </div>
        <div class="row">
          <span>Tipo de cobertura</span>
          <strong v-if="charge.cobertura">{{ COBERTURA_LABEL[charge.cobertura.tipo] }}</strong>
          <strong v-else class="quiet">No registrada</strong>
        </div>
        <div v-if="charge.cobertura?.entidad" class="row">
          <span>{{ charge.cobertura.tipo === 'MEDICINA_PREPAGA' ? 'Medicina prepaga' : 'Obra social' }}</span>
          <strong>{{ coverageLabel(charge) }}</strong>
        </div>
      </section>

      <section class="block">
        <h3>Desglose económico</h3>
        <div class="economic">
          <div class="row"><span>Valor base</span><strong>{{ formatMoney(charge.importePesos) }}</strong></div>
          <template v-if="charge.cobertura?.pacientePesos != null && charge.cobertura.terceroPesos != null">
            <div class="row patient-row">
              <span>
                A cargo del paciente
                <small>{{ charge.cobertura.tipo === 'MEDICINA_PREPAGA' ? 'Copago fijo' : charge.cobertura.tipo === 'PARTICULAR' ? '100% del valor' : 'Sin cargo' }}</small>
              </span>
              <strong>{{ formatMoney(charge.cobertura.pacientePesos) }}</strong>
            </div>
            <div class="row third-row">
              <span>
                A cargo de {{ thirdPartyLabel(charge) }}
                <small>{{ charge.cobertura.tipo === 'MEDICINA_PREPAGA' ? 'Reclamo a terceros' : charge.cobertura.tipo === 'OBRA_SOCIAL_PUBLICA' ? 'Cargo subsidiado' : 'No corresponde' }}</small>
              </span>
              <strong>{{ formatMoney(charge.cobertura.terceroPesos) }}</strong>
            </div>
            <div class="row total">
              <span>Distribución total</span>
              <strong>{{ formatMoney(charge.cobertura.pacientePesos + charge.cobertura.terceroPesos) }}</strong>
            </div>
          </template>
          <div v-else class="row total"><span>Importe del cargo</span><strong>{{ formatMoney(charge.importePesos) }}</strong></div>
        </div>
        <p v-if="charge.cobertura" class="note">
          El importe se distribuye según la estrategia de cobro de «{{ COBERTURA_LABEL[charge.cobertura.tipo] }}».
          La cobertura queda congelada en el cargo: cambiarla después en el paciente no modifica lo ya facturado.
        </p>
        <p v-else class="note">
          Este cargo se emitió antes de registrar la cobertura de los pacientes, por eso no tiene reparto entre paciente y tercero.
        </p>
      </section>

      <section class="block">
        <h3>Trazabilidad</h3>
        <div class="trace">
          <span class="node"><AppIcon name="check" :size="16" /></span>
          <div>
            <span>Proceso de origen</span>
            <strong>Cargo generado al pasar el turno a Atendido</strong>
            <small>{{ formatDateTime(charge.createdAt) }} · ID del cargo <code>{{ charge.id }}</code></small>
          </div>
        </div>
      </section>
    </div>
  </SideDrawer>
</template>

<style scoped>
.detail { display: grid; gap: 22px; }
.summary { display: grid; gap: 6px; padding: 18px; border: 1px solid #b7d9d1; border-radius: 14px; background: var(--color-brand-soft); }
.eyebrow { color: var(--color-muted); font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.amount { font-size: 2rem; line-height: 1.1; color: var(--color-brand-dark); }
.divider { height: 1px; margin: 6px 0; background: #b7d9d1; }
.meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.meta div { display: grid; gap: 2px; }
.meta span { color: var(--color-muted); font-size: 0.78rem; }
.block { display: grid; gap: 10px; }
.block h3 { margin: 0; font-family: var(--font); font-size: 0.95rem; letter-spacing: 0; }
.grid { display: grid; gap: 10px; margin: 0; }
.grid div { display: grid; gap: 2px; }
dt { color: var(--color-muted); font-size: 0.78rem; }
dd { margin: 0; font-weight: 600; }
.quiet { color: #8a9692; font-weight: 500; }
code { font-size: 0.78rem; word-break: break-all; }
.patient { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--color-line); border-radius: 12px; }
.patient div { display: grid; line-height: 1.3; }
.patient span:not(.avatar) { color: var(--color-muted); font-size: 0.8rem; }
.avatar { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--color-brand-soft); color: var(--color-brand-dark); font-weight: 700; flex: none; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; }
.row > span { color: var(--color-muted); }
.economic { border: 1px solid var(--color-line); border-radius: 12px; padding: 4px 14px; background: #fff; }
.economic .row + .row { border-top: 1px solid var(--color-line); }
.economic .total strong { color: var(--color-brand-dark); }
.row small { display: block; color: var(--color-muted); font-size: 0.75rem; }
.patient-row strong { color: var(--color-brand-dark); }
.note { margin: 0; padding: 10px 12px; border-radius: 10px; background: #f3f6f5; color: var(--color-muted); font-size: 0.82rem; }
.trace { display: flex; gap: 12px; padding: 12px; border: 1px solid var(--color-line); border-radius: 12px; }
.trace div { display: grid; gap: 2px; line-height: 1.35; min-width: 0; }
.trace span:not(.node), .trace small { color: var(--color-muted); font-size: 0.78rem; }
.node { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--color-brand-soft); color: var(--color-brand); flex: none; }
</style>
