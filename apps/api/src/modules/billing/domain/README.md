# Billing / Domain

## Responsabilidad

La capa de dominio de Billing contiene las reglas que determinan los importes de las prestaciones y cómo se distribuyen los costos según el tipo de cobertura del paciente.

Su objetivo es mantener estas reglas separadas de los controladores, servicios y mecanismos de persistencia.

## Componentes principales

### 1. Estrategia de facturación

- **`billing.strategy.ts`**: define la interfaz `BillingStrategy`, que establece el contrato común para las estrategias de facturación. Cada estrategia debe indicar el tipo de atención facturable e implementar el método `calculateAmount()`.

- **`consulta-regular.strategy.ts`**: implementa la estrategia para consultas regulares. El importe establecido es de $15.000.

- **`consulta-urgencia.strategy.ts`**: implementa la estrategia para consultas de urgencia. El importe establecido es de $25.000.

Estas estrategias permiten calcular distintos importes según el tipo de atención utilizando el patrón Strategy.

### 2. Estrategias de cobertura

El archivo **`coverage.strategy.ts`** contiene las reglas para distribuir el valor de una prestación entre el paciente y un tercero, como el Estado o una empresa de medicina prepaga.

Define:

- **`CoverageBreakdown`**: representa los importes que corresponden al paciente (`pacientePesos`) y al tercero (`terceroPesos`).
- **`CoverageStrategy`**: establece el contrato que deben implementar las estrategias de cobertura, mediante el tipo de cobertura y el método `split()`.

Se implementan tres estrategias:

- **Obra social pública (`ObraSocialPublicaStrategy`)**: el tercero cubre el 100% del valor y el paciente no abona ningún importe.
- **Medicina prepaga (`MedicinaPrepagaStrategy`)**: el paciente abona un copago fijo de $3.000 y la prepaga cubre el resto. El copago no puede superar el valor total de la prestación.
- **Particular (`ParticularStrategy`)**: el paciente abona el 100% del valor de la prestación y no se factura ningún importe a un tercero.

El valor del copago se encuentra definido en la constante `COPAGO_PREPAGA_PESOS`. El código aclara que está pendiente incorporar los valores reales definidos por el nomenclador para cada prepaga.

### 3. Selección de estrategias

La función `coverageStrategyFor()` permite obtener la estrategia correspondiente según el tipo de cobertura (`CoverageType`).

Las estrategias se organizan en un registro que relaciona cada tipo de cobertura con su implementación.

### 4. Pruebas

El archivo `coverage.strategy.spec.ts` contiene pruebas relacionadas con las estrategias de cobertura.

## Consideraciones

- Las reglas de cálculo de importes y distribución de cobertura pertenecen al dominio.
- Las estrategias permiten incorporar diferentes comportamientos sin concentrar todas las reglas en una única implementación.
- Los importes de las consultas regulares y de urgencia están definidos actualmente como valores fijos.
- El copago de medicina prepaga utiliza un valor único provisional de $3.000, pendiente de ajustarse al nomenclador real.

## Archivos de esta capa

- `billing.strategy.ts`
- `consulta-regular.strategy.ts`
- `consulta-urgencia.strategy.ts`
- `coverage.strategy.ts`
- `coverage.strategy.spec.ts`
