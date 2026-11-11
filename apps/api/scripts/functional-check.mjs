import pg from 'pg';

const API = process.env.API_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const DB_URL = process.env.DATABASE_URL;
const ROOT_EMAIL = process.env.SUPERADMIN_EMAIL;
const ROOT_PASSWORD = process.env.SUPERADMIN_PASSWORD;

if (!DB_URL || !ROOT_EMAIL || !ROOT_PASSWORD) {
  throw new Error('Faltan DATABASE_URL, SUPERADMIN_EMAIL o SUPERADMIN_PASSWORD.');
}
for (const url of [DB_URL, API]) {
  const host = new URL(url).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`SEGURIDAD: esta prueba escribe datos y solo admite localhost (recibió ${host}).`);
  }
}

const db = new pg.Client({ connectionString: DB_URL, ssl: false });
const run = Date.now().toString(36);
const PASSWORD = 'Clave5Segura8';
const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, path, { token, body, cookie, origin } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (origin !== false) headers.origin = origin ?? ORIGIN;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, body: parsed, cookie: setCookie ? setCookie.split(';')[0] : undefined };
}

async function login(email, password = PASSWORD) {
  const res = await api('POST', '/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`Login de ${email} falló: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, cookie: res.cookie, account: res.body.account };
}

async function caso(hu, nombre, esperado, check) {
  let ok = false;
  let obs = '';
  try {
    ({ ok, obs = '' } = await check());
  } catch (error) {
    obs = `Excepción: ${error instanceof Error ? error.message : String(error)}`;
  }
  results.push({ hu, nombre, esperado, ok, obs });
  console.error(`${ok ? 'PASÓ ' : 'FALLÓ'} | ${hu} | ${nombre}${obs ? ` | ${obs}` : ''}`);
}

const statuses = (responses) => responses.map((r) => r.status).sort().join(', ');

async function main() {
  await db.connect();

  const root = await login(ROOT_EMAIL, ROOT_PASSWORD);

  const emails = {
    admin: `admin.${run}@prueba.local`,
    medico: `medico.${run}@prueba.local`,
    medico2: `medico2.${run}@prueba.local`,
    enfermero: `enfermero.${run}@prueba.local`,
    bloqueo: `bloqueo.${run}@prueba.local`,
  };
  const must = (res, expected, what) => {
    if (res.status !== expected) throw new Error(`${what}: esperaba ${expected}, llegó ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  };
  must(
    await api('POST', '/usuarios/administrativos', { token: root.token, body: { nombre: 'Ana', apellido: 'Admin', email: emails.admin, password: PASSWORD } }),
    201,
    'alta de administrativo',
  );
  for (const [key, rol] of [['medico', 'MEDICO'], ['medico2', 'MEDICO'], ['enfermero', 'ENFERMERO'], ['bloqueo', 'ENFERMERO']]) {
    must(
      await api('POST', '/usuarios', { token: root.token, body: { nombre: key, apellido: 'Prueba', email: emails[key], password: PASSWORD, rol } }),
      201,
      `alta de ${key}`,
    );
  }
  const usuarios = must(await api('GET', '/usuarios', { token: root.token }), 200, 'listado de usuarios');
  const idDe = (email) => usuarios.find((u) => u.email === email).id;
  for (const key of ['medico', 'medico2']) {
    const cuenta = usuarios.find((u) => u.email === emails[key]);
    if (cuenta.estado !== 'ACTIVO') must(await api('PATCH', `/usuarios/${cuenta.id}/habilitar`, { token: root.token }), 200, `habilitar ${key}`);
  }

  const admin = await login(emails.admin);
  const medico = await login(emails.medico);
  const enfermero = await login(emails.enfermero);

  const pacientes = [];
  for (let i = 0; i < 6; i += 1) {
    const documento = String(10_000_000 + Math.floor(Math.random() * 89_000_000));
    const p = must(
      await api('POST', '/pacientes', {
        token: admin.token,
        body: { nombre: `Paciente${i}`, apellido: `Prueba ${run}`, documento, fechaNacimiento: '1980-05-10', tipoCobertura: 'PARTICULAR' },
      }),
      201,
      'alta de paciente',
    );
    pacientes.push(p.id);
  }

  const camas = [];
  for (let i = 0; i < 5; i += 1) {
    const { rows } = await db.query(`INSERT INTO camas (numero, sector, estado) VALUES ($1, 'Prueba funcional', 'LIBRE') RETURNING id`, [`P${run.slice(-6)}${i}`]);
    camas.push(rows[0].id);
  }
  const insumo = async (nombre, cantidad) =>
    (
      await db.query(
        `INSERT INTO insumos (nombre, unidad_medida, cantidad_disponible, precio_pesos) VALUES ($1, 'comprimido', $2, 250) RETURNING id`,
        [`${nombre} ${run}`, cantidad],
      )
    ).rows[0].id;
  const ibuprofeno = await insumo('Ibuprofeno 400mg', 50);
  const escaso = await insumo('Insumo escaso', 10);
  const stockDe = async (id) => (await db.query(`SELECT cantidad_disponible FROM insumos WHERE id = $1`, [id])).rows[0].cantidad_disponible;

  await caso('Recursos 1.1', 'Dos asignaciones simultáneas de la misma cama', 'Una 201 y una 409', async () => {
    const [a, b] = await Promise.all([
      api('POST', `/camas/${camas[0]}/asignar`, { token: admin.token, body: { pacienteId: pacientes[0], medicoId: idDe(emails.medico) } }),
      api('POST', `/camas/${camas[0]}/asignar`, { token: admin.token, body: { pacienteId: pacientes[1], medicoId: idDe(emails.medico) } }),
    ]);
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM internaciones WHERE cama_id = $1 AND fecha_egreso IS NULL`, [camas[0]]);
    const rechazo = [a, b].find((r) => r.status === 409);
    return { ok: statuses([a, b]) === '201, 409' && rows[0].n === 1, obs: `HTTP ${statuses([a, b])}; internaciones activas: ${rows[0].n}; mensaje: "${rechazo?.body?.message}"` };
  });

  const ganador = (await db.query(`SELECT paciente_id FROM internaciones WHERE cama_id = $1 AND fecha_egreso IS NULL`, [camas[0]])).rows[0].paciente_id;
  await caso('Recursos 1.1', 'Un paciente ya internado no puede ocupar otra cama', '409', async () => {
    const res = await api('POST', `/camas/${camas[1]}/asignar`, { token: admin.token, body: { pacienteId: ganador, medicoId: idDe(emails.medico) } });
    return { ok: res.status === 409, obs: `HTTP ${res.status}: "${res.body?.message}"` };
  });

  await caso('Recursos 1.1', 'Vínculo paciente, cama y marca temporal de ingreso', 'Internación persistida', async () => {
    const { rows } = await db.query(`SELECT paciente_id, cama_id, fecha_ingreso FROM internaciones WHERE cama_id = $1 AND fecha_egreso IS NULL`, [camas[0]]);
    const cama = (await api('GET', `/camas/${camas[0]}`, { token: enfermero.token })).body;
    return { ok: rows.length === 1 && rows[0].fecha_ingreso instanceof Date && cama.estado === 'OCUPADA' && cama.paciente?.id === ganador, obs: `estado ${cama.estado}; fecha_ingreso ${rows[0]?.fecha_ingreso?.toISOString()}` };
  });

  const recibidos = [];
  const abort = new AbortController();
  const stream = await fetch(`${API}/camas/eventos`, { headers: { authorization: `Bearer ${admin.token}` }, signal: abort.signal });
  const streamInfo = { status: stream.status, contentType: stream.headers.get('content-type') };
  (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of stream.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let corte;
        while ((corte = buffer.indexOf('\n\n')) >= 0) {
          const bloque = buffer.slice(0, corte);
          buffer = buffer.slice(corte + 2);
          const data = bloque.split('\n').find((l) => l.startsWith('data: '));
          if (data && !bloque.includes('event: ping')) recibidos.push(JSON.parse(data.slice(6)));
        }
      }
    } catch {
    }
  })();
  await sleep(300);

  let protocolo;
  await caso('Enfermería 2.1', 'Asignar cama con motivo "Cirugía programada"', 'Aparece el protocolo pre-quirúrgico sin llamar a POST /protocolos/ingresos', async () => {
    const res = await api('POST', `/camas/${camas[2]}/asignar`, { token: admin.token, body: { pacienteId: pacientes[2], medicoId: idDe(emails.medico), motivoIngreso: '  Cirugía programada  ' } });
    await sleep(400);
    const lista = (await api('GET', `/protocolos?pacienteId=${pacientes[2]}`, { token: enfermero.token })).body;
    protocolo = lista?.[0];
    const { rows } = await db.query(`SELECT id, motivo_ingreso FROM internaciones WHERE cama_id = $1 AND fecha_egreso IS NULL`, [camas[2]]);
    const tareas = protocolo?.tareas?.map((t) => t.descripcion) ?? [];
    const ok =
      res.status === 201 && lista.length === 1 && protocolo.tipo === 'PRE_QUIRURGICO' && protocolo.ingresoId === rows[0].id &&
      rows[0].motivo_ingreso === 'Cirugía programada' &&
      JSON.stringify(tareas) === JSON.stringify(['Verificar ayuno de 8 horas', 'Colocar vía intravenosa periférica', 'Realizar control de signos vitales cada 2 horas']);
    return { ok, obs: `HTTP ${res.status}; tipo ${protocolo?.tipo}; tareas: ${tareas.join(' / ')}; motivo guardado: "${rows[0]?.motivo_ingreso}"` };
  });

  await caso('Enfermería 2.1', 'Reintentar el mismo ingreso', 'No duplica el protocolo', async () => {
    const res = await api('POST', '/protocolos/ingresos', { token: admin.token, body: { ingresoId: protocolo.ingresoId, pacienteId: pacientes[2], motivoIngreso: 'Cirugía programada' } });
    const lista = (await api('GET', `/protocolos?pacienteId=${pacientes[2]}`, { token: enfermero.token })).body;
    return { ok: res.status === 201 && res.body.id === protocolo.id && lista.length === 1, obs: `HTTP ${res.status}; mismo protocolo: ${res.body?.id === protocolo.id}; protocolos del paciente: ${lista.length}` };
  });

  await caso('Enfermería 2.1', 'Asignar cama con motivo "Neumonía"', 'Protocolo respiratorio', async () => {
    const res = await api('POST', `/camas/${camas[3]}/asignar`, { token: medico.token, body: { pacienteId: pacientes[3], motivoIngreso: 'Neumonía' } });
    await sleep(400);
    const lista = (await api('GET', `/protocolos?pacienteId=${pacientes[3]}`, { token: enfermero.token })).body;
    const tareas = lista?.[0]?.tareas?.map((t) => t.descripcion) ?? [];
    const ok = res.status === 201 && lista.length === 1 && lista[0].tipo === 'RESPIRATORIO' &&
      tareas.includes('Monitoreo de saturación de oxígeno continuo') && tareas.includes('Indicación de aislamiento de contacto y gotas');
    return { ok, obs: `HTTP ${res.status}; tipo ${lista?.[0]?.tipo}; tareas: ${tareas.join(' / ')}` };
  });

  await caso('Enfermería 2.1', 'Asignar cama sin motivo', 'Cama ocupada y ningún protocolo', async () => {
    const res = await api('POST', `/camas/${camas[4]}/asignar`, { token: admin.token, body: { pacienteId: pacientes[4], medicoId: idDe(emails.medico2) } });
    await sleep(300);
    const lista = (await api('GET', `/protocolos?pacienteId=${pacientes[4]}`, { token: enfermero.token })).body;
    return { ok: res.status === 201 && lista.length === 0, obs: `HTTP ${res.status}; protocolos: ${lista.length}` };
  });

  await caso('Enfermería 2.1', 'PATCH /protocolos/:id/tareas/:tareaId', 'Guarda quién y cuándo', async () => {
    const tarea = protocolo.tareas[0];
    const res = await api('PATCH', `/protocolos/${protocolo.id}/tareas/${tarea.id}`, { token: enfermero.token, body: { hecha: true } });
    const marcada = res.body?.tareas?.find((t) => t.id === tarea.id);
    return { ok: res.status === 200 && marcada?.hecha === true && Boolean(marcada.hechaEn) && Boolean(marcada.hechaPor), obs: `HTTP ${res.status}; hecha=${marcada?.hecha}; hechaPor="${marcada?.hechaPor}"; hechaEn=${marcada?.hechaEn}` };
  });

  await caso('Recursos 2.1', 'Alta, limpieza y confirmación', 'OCUPADA → EN_LIMPIEZA → LIBRE', async () => {
    const alta = await api('POST', `/camas/${camas[0]}/alta`, { token: medico.token });
    const enLimpieza = await api('POST', `/camas/${camas[0]}/asignar`, { token: admin.token, body: { pacienteId: pacientes[5], medicoId: idDe(emails.medico) } });
    const limpia = await api('POST', `/camas/${camas[0]}/limpieza/confirmar`, { token: enfermero.token });
    const ok = alta.body?.estado === 'EN_LIMPIEZA' && enLimpieza.status === 409 && limpia.body?.estado === 'LIBRE';
    return { ok, obs: `alta → ${alta.body?.estado}; asignar en limpieza → HTTP ${enLimpieza.status} "${enLimpieza.body?.message}"; confirmar → ${limpia.body?.estado}` };
  });

  await caso('Recursos 2.1', 'Transiciones inválidas', '409 en cada una', async () => {
    const limpiarLibre = await api('POST', `/camas/${camas[0]}/limpieza/confirmar`, { token: enfermero.token });
    const altaLibre = await api('POST', `/camas/${camas[0]}/alta`, { token: medico.token });
    const bloquearOcupada = await api('POST', `/camas/${camas[2]}/bloquear`, { token: admin.token });
    const todos = [limpiarLibre, altaLibre, bloquearOcupada];
    return { ok: todos.every((r) => r.status === 409), obs: `confirmar limpieza en LIBRE: ${limpiarLibre.status}; alta en LIBRE: ${altaLibre.status}; bloquear OCUPADA: ${bloquearOcupada.status}` };
  });

  await caso('Recursos 2.1', 'Bloqueo por mantenimiento', 'LIBRE → BLOQUEADA → LIBRE; no se asigna bloqueada', async () => {
    const bloqueada = await api('POST', `/camas/${camas[0]}/bloquear`, { token: admin.token });
    const asignar = await api('POST', `/camas/${camas[0]}/asignar`, { token: admin.token, body: { pacienteId: pacientes[5], medicoId: idDe(emails.medico) } });
    const libre = await api('POST', `/camas/${camas[0]}/desbloquear`, { token: admin.token });
    return { ok: bloqueada.body?.estado === 'BLOQUEADA' && asignar.status === 409 && libre.body?.estado === 'LIBRE', obs: `bloquear → ${bloqueada.body?.estado}; asignar bloqueada → HTTP ${asignar.status}; desbloquear → ${libre.body?.estado}` };
  });

  await caso('Recursos 2.1', 'GET /camas/eventos abierto mientras se opera (B3)', 'Llegan los eventos en vivo', async () => {
    await sleep(300);
    abort.abort();
    const tipos = recibidos.map((e) => e.tipo);
    const esperados = ['bed.assigned', 'bed.released', 'bed.cleaned', 'bed.blocked', 'bed.unblocked'];
    const ok = streamInfo.status === 200 && String(streamInfo.contentType).includes('text/event-stream') && esperados.every((t) => tipos.includes(t));
    return { ok, obs: `HTTP ${streamInfo.status} ${streamInfo.contentType}; ${recibidos.length} eventos: ${tipos.join(', ')}` };
  });

  await caso('Recursos 2.1', 'Stream sin token y con token por query string', '401 en ambos', async () => {
    const sinToken = await fetch(`${API}/camas/eventos`);
    const porQuery = await fetch(`${API}/camas/eventos?access_token=${admin.token}`);
    await sinToken.body?.cancel();
    await porQuery.body?.cancel();
    return { ok: sinToken.status === 401 && porQuery.status === 401, obs: `sin token: ${sinToken.status}; por query: ${porQuery.status}` };
  });

  const control = (temperatura, extra = {}) => ({ pacienteId: pacientes[2], sistolica: 120, diastolica: 80, frecuenciaCardiaca: 72, temperatura, ...extra });

  await caso('Enfermería 1.1', 'Control con valores normales', '201, critico: false y nota automática', async () => {
    const res = await api('POST', '/signos-vitales/controles', { token: enfermero.token, body: control(36.6) });
    return { ok: res.status === 201 && res.body.critico === false && Boolean(res.body.nota), obs: `HTTP ${res.status}; critico=${res.body?.critico}; nota: "${res.body?.nota}"` };
  });

  await caso('Enfermería 1.1', 'Control con temperatura 39,5', '201, critico: true, nota y notificación de alta prioridad al médico', async () => {
    const antes = (await api('GET', '/notificaciones', { token: medico.token })).body.length;
    const res = await api('POST', '/signos-vitales/controles', { token: enfermero.token, body: control(39.5) });
    await sleep(400);
    const notificaciones = (await api('GET', '/notificaciones', { token: medico.token })).body;
    const otras = (await api('GET', '/notificaciones', { token: (await login(emails.medico2)).token })).body;
    const nueva = notificaciones[0];
    const ok = res.status === 201 && res.body.critico === true && notificaciones.length === antes + 1 && nueva?.prioridad === 'ALTA';
    return { ok, obs: `HTTP ${res.status}; critico=${res.body?.critico}; nota: "${res.body?.nota}"; notificación al médico responsable: prioridad ${nueva?.prioridad}, "${nueva?.mensaje}"; otro médico recibió ${otras.length}` };
  });

  await caso('Enfermería 1.1', 'Control con valor implausible', '400 y no se guarda nada', async () => {
    const antes = (await db.query(`SELECT count(*)::int AS n FROM signos_vitales WHERE paciente_id = $1`, [pacientes[2]])).rows[0].n;
    const res = await api('POST', '/signos-vitales/controles', { token: enfermero.token, body: control(60) });
    const despues = (await db.query(`SELECT count(*)::int AS n FROM signos_vitales WHERE paciente_id = $1`, [pacientes[2]])).rows[0].n;
    return { ok: res.status === 400 && antes === despues, obs: `HTTP ${res.status}; filas antes ${antes}, después ${despues}; "${[].concat(res.body?.message ?? '').join(' ')}"` };
  });

  const nuevaIndicacion = async () =>
    must(await api('POST', '/indicaciones', { token: medico.token, body: { pacienteId: pacientes[2], insumoId: ibuprofeno, dosis: '400 mg', frecuenciaHoras: 8 } }), 201, 'crear indicación');

  await caso('Enfermería 1.2 / Recursos 3.1', 'Administrar dentro de ±30 min', '201, registra al enfermero y descuenta 1 unidad (50 → 49)', async () => {
    const indicacion = await nuevaIndicacion();
    const res = await api('POST', `/indicaciones/${indicacion.id}/administraciones`, { token: enfermero.token, body: { observaciones: 'Prueba funcional' } });
    await sleep(500);
    const stock = await stockDe(ibuprofeno);
    const { rows } = await db.query(`SELECT enfermero_id FROM administraciones_medicacion WHERE indicacion_id = $1`, [indicacion.id]);
    const cargos = (await api('GET', '/billing/cargos', { token: admin.token })).body;
    const cargo = cargos.find((c) => c.tipoAtencion === 'FARMACIA' && c.concepto === 'Insumos de Farmacia');
    const ok = res.status === 201 && stock === 49 && rows.length === 1 && rows[0].enfermero_id === idDe(emails.enfermero);
    return { ok, obs: `HTTP ${res.status}; stock ${stock}; enfermero vinculado: ${rows[0]?.enfermero_id === idDe(emails.enfermero)}; cargo de farmacia: ${cargo ? `sí ($${cargo.importePesos})` : 'no encontrado'}` };
  });

  await caso('Enfermería 1.2', 'Administrar fuera de ±30 min', 'Rechazada (409) y sin descuento', async () => {
    const indicacion = await nuevaIndicacion();
    await db.query(`UPDATE indicaciones_medicas SET fecha_inicio = now() - interval '2 hours' WHERE id = $1`, [indicacion.id]);
    const antes = await stockDe(ibuprofeno);
    const res = await api('POST', `/indicaciones/${indicacion.id}/administraciones`, { token: enfermero.token, body: {} });
    await sleep(300);
    return { ok: res.status === 409 && (await stockDe(ibuprofeno)) === antes, obs: `HTTP ${res.status}: "${res.body?.message}"; stock sin cambios: ${(await stockDe(ibuprofeno)) === antes}` };
  });

  await caso('Enfermería 1.2', 'Dos administraciones simultáneas de la misma dosis', 'Una sola se registra', async () => {
    const indicacion = await nuevaIndicacion();
    const antes = await stockDe(ibuprofeno);
    const respuestas = await Promise.all([1, 2, 3].map(() => api('POST', `/indicaciones/${indicacion.id}/administraciones`, { token: enfermero.token, body: {} })));
    await sleep(500);
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM administraciones_medicacion WHERE indicacion_id = $1`, [indicacion.id]);
    const stock = await stockDe(ibuprofeno);
    return { ok: statuses(respuestas) === '201, 409, 409' && rows[0].n === 1 && stock === antes - 1, obs: `HTTP ${statuses(respuestas)}; administraciones guardadas: ${rows[0].n}; stock ${antes} → ${stock}` };
  });

  await caso('Recursos 3.1', 'Descuento concurrente con stock justo', 'Sin stock negativo; 409 cuando falta', async () => {
    const respuestas = await Promise.all(Array.from({ length: 15 }, () => api('POST', '/resources/inventory/descontar', { token: medico.token, body: { insumoId: escaso, cantidad: 1 } })));
    const ok201 = respuestas.filter((r) => r.status === 201 || r.status === 200).length;
    const conflictos = respuestas.filter((r) => r.status === 409).length;
    const stock = await stockDe(escaso);
    return { ok: ok201 === 10 && conflictos === 5 && stock === 0, obs: `15 pedidos sobre 10 unidades: ${ok201} aceptados, ${conflictos} con 409; stock final ${stock}` };
  });

  await caso('IAM', 'Login y GET /auth/me', '200 con access token y cookie de refresh HttpOnly', async () => {
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email: emails.enfermero, password: PASSWORD }) });
    const setCookie = res.headers.get('set-cookie') ?? '';
    const body = await res.json();
    const me = await api('GET', '/auth/me', { token: body.accessToken });
    const ok = res.status === 200 && Boolean(body.accessToken) && !('refreshToken' in body) && /HttpOnly/i.test(setCookie) && me.status === 200 && me.body.rol === 'ENFERMERO';
    return { ok, obs: `HTTP ${res.status}; refresh fuera del JSON: ${!('refreshToken' in body)}; cookie HttpOnly: ${/HttpOnly/i.test(setCookie)}; /auth/me → ${me.body?.rol}` };
  });

  await caso('IAM', 'Refresh rotativo', 'Token nuevo; el refresh ya usado se rechaza y revoca la familia', async () => {
    const sesion = await login(emails.enfermero);
    const primero = await api('POST', '/auth/refresh', { cookie: sesion.cookie });
    const reuso = await api('POST', '/auth/refresh', { cookie: sesion.cookie });
    const familia = await api('POST', '/auth/refresh', { cookie: primero.cookie });
    const ok = primero.status === 200 && primero.cookie !== sesion.cookie && reuso.status === 401 && familia.status === 401;
    return { ok, obs: `refresh → ${primero.status} (cookie rotada: ${primero.cookie !== sesion.cookie}); reuso del anterior → ${reuso.status}; el nuevo tras el reuso → ${familia.status}` };
  });

  await caso('IAM', 'Logout', '204 y el refresh deja de servir', async () => {
    const sesion = await login(emails.enfermero);
    const salida = await api('POST', '/auth/logout', { cookie: sesion.cookie });
    const despues = await api('POST', '/auth/refresh', { cookie: sesion.cookie });
    return { ok: salida.status === 204 && despues.status === 401, obs: `logout → ${salida.status}; refresh posterior → ${despues.status}` };
  });

  await caso('IAM', 'Origen no permitido en /auth/login', '403', async () => {
    const ajeno = await api('POST', '/auth/login', { body: { email: emails.enfermero, password: PASSWORD }, origin: 'http://sitio-ajeno.example' });
    const sinOrigen = await api('POST', '/auth/login', { body: { email: emails.enfermero, password: PASSWORD }, origin: false });
    return { ok: ajeno.status === 403 && sinOrigen.status === 403, obs: `origen ajeno → ${ajeno.status}; sin Origin → ${sinOrigen.status}` };
  });

  await caso('IAM', 'Bloqueo tras intentos fallidos', '5 fallos → cuenta bloqueada; ni la contraseña correcta entra', async () => {
    const intentos = [];
    for (let i = 0; i < 5; i += 1) intentos.push((await api('POST', '/auth/login', { body: { email: emails.bloqueo, password: 'Incorrecta9A' } })).status);
    const correcta = await api('POST', '/auth/login', { body: { email: emails.bloqueo, password: PASSWORD } });
    const { rows } = await db.query(`SELECT bloqueado_hasta FROM usuarios WHERE email = $1`, [emails.bloqueo]);
    const minutos = rows[0].bloqueado_hasta ? Math.round((rows[0].bloqueado_hasta.getTime() - Date.now()) / 60000) : null;
    const ok = intentos.every((s) => s === 401) && correcta.status === 401 && minutos !== null && minutos >= 14 && minutos <= 15;
    return { ok, obs: `intentos fallidos → ${intentos.join(', ')}; contraseña correcta después → ${correcta.status}; bloqueo de ~${minutos} min; mismo mensaje genérico: "${correcta.body?.message}"` };
  });

  await caso('IAM', 'Sin token y con token inválido', '401', async () => {
    const sin = await api('GET', '/camas');
    const invalido = await api('GET', '/camas', { token: `${admin.token.slice(0, -2)}xx` });
    return { ok: sin.status === 401 && invalido.status === 401, obs: `sin token → ${sin.status}; token adulterado → ${invalido.status}` };
  });

  const prohibidos = [
    ['ENFERMERO', enfermero, 'POST', `/camas/${camas[0]}/asignar`, { pacienteId: pacientes[5] }],
    ['ENFERMERO', enfermero, 'POST', `/camas/${camas[0]}/bloquear`],
    ['ENFERMERO', enfermero, 'POST', '/resources/inventory/descontar', { insumoId: ibuprofeno, cantidad: 1 }],
    ['ENFERMERO', enfermero, 'POST', '/protocolos/ingresos', { ingresoId: protocolo?.ingresoId, pacienteId: pacientes[2], motivoIngreso: 'Neumonía' }],
    ['ENFERMERO', enfermero, 'GET', '/usuarios'],
    ['ENFERMERO', enfermero, 'GET', '/billing/cargos'],
    ['MEDICO', medico, 'POST', `/camas/${camas[0]}/limpieza/confirmar`],
    ['MEDICO', medico, 'POST', `/camas/${camas[0]}/bloquear`],
    ['MEDICO', medico, 'GET', '/usuarios'],
    ['MEDICO', medico, 'GET', '/billing/cargos'],
    ['MEDICO', medico, 'POST', `/indicaciones/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}/administraciones`, {}],
    ['ADMINISTRATIVO', admin, 'GET', `/protocolos?pacienteId=${pacientes[2]}`],
    ['ADMINISTRATIVO', admin, 'POST', '/signos-vitales/controles', control(36.5)],
    ['ADMINISTRATIVO', admin, 'POST', '/resources/inventory/descontar', { insumoId: ibuprofeno, cantidad: 1 }],
    ['ADMINISTRATIVO', admin, 'POST', '/usuarios/administrativos', { nombre: 'X', apellido: 'Y', email: `x.${run}@prueba.local`, password: PASSWORD }],
    ['ADMINISTRATIVO', admin, 'PATCH', `/usuarios/${idDe(emails.enfermero)}/baja`],
  ];
  await caso('IAM', 'Cada rol contra endpoints que no le corresponden', '403 en todos', async () => {
    const fallas = [];
    for (const [rol, sesion, method, path, body] of prohibidos) {
      const res = await api(method, path, { token: sesion.token, body });
      if (res.status !== 403) fallas.push(`${rol} ${method} ${path.split('?')[0]} → ${res.status}`);
    }
    return { ok: fallas.length === 0, obs: fallas.length ? fallas.join('; ') : `${prohibidos.length} combinaciones rol/endpoint, todas 403` };
  });

  await caso('IAM', 'Protecciones de cuentas', 'Nadie se deshabilita a sí mismo ni al superadmin raíz', async () => {
    const propio = await api('PATCH', `/usuarios/${admin.account.id}/deshabilitar`, { token: admin.token });
    const raiz = await api('PATCH', `/usuarios/${root.account.id}/deshabilitar`, { token: admin.token });
    return { ok: propio.status === 409 && raiz.status === 409, obs: `a sí mismo → ${propio.status} "${propio.body?.message}"; al superadmin → ${raiz.status} "${raiz.body?.message}"` };
  });

  await caso('IAM', 'Deshabilitar revoca la sesión', 'El access token deja de servir de inmediato', async () => {
    const sesion = await login(emails.medico2);
    const antes = await api('GET', '/camas', { token: sesion.token });
    const baja = await api('PATCH', `/usuarios/${idDe(emails.medico2)}/deshabilitar`, { token: admin.token });
    const despues = await api('GET', '/camas', { token: sesion.token });
    const relogin = await api('POST', '/auth/login', { body: { email: emails.medico2, password: PASSWORD } });
    return { ok: antes.status === 200 && baja.status === 200 && despues.status === 401 && relogin.status === 401, obs: `antes → ${antes.status}; deshabilitar → ${baja.status}; mismo token después → ${despues.status}; login → ${relogin.status}` };
  });
}

try {
  await main();
} catch (error) {
  console.error('La prueba se interrumpió:', error);
  results.push({ hu: 'Preparación', nombre: 'Datos de prueba', esperado: 'Sin errores', ok: false, obs: String(error instanceof Error ? error.message : error) });
} finally {
  await db.end().catch(() => undefined);
}

const escape = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
console.log('| HU | Qué se probó | Resultado esperado | Resultado | Observación |');
console.log('| --- | --- | --- | --- | --- |');
for (const r of results) console.log(`| ${r.hu} | ${escape(r.nombre)} | ${escape(r.esperado)} | ${r.ok ? 'Pasó' : '**Falló**'} | ${escape(r.obs)} |`);
const fallidos = results.filter((r) => !r.ok).length;
console.log(`\nTotal: ${results.length} casos, ${results.length - fallidos} pasaron, ${fallidos} fallaron.`);
process.exit(fallidos === 0 ? 0 : 1);
