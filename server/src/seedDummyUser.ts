import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  const email = 'usuario@gmail.com';
  const password = 'usuario123';
  const name = 'Usuario Demo';
  const nickname = 'AtletaEvolve';

  console.log(`Iniciando creación de usuario dummy: ${email}...`);

  // 1. Crear o actualizar usuario
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name,
      nickname,
      provider: 'email',
    },
    create: {
      email,
      passwordHash,
      name,
      nickname,
      provider: 'email',
    },
  });

  console.log(`Usuario creado con ID: ${user.id}`);

  // Catálogos base
  const ingredients = [
    { id: 'seed-pb', name: 'Mantequilla de maní', servingGrams: 50, kcal: 110, protein: 12, carbs: 5, fat: 17, sugar: 2.1, unit: 'g' },
    { id: 'seed-egg', name: 'Huevo', servingGrams: 1, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, sugar: 0.2, unit: 'ud' },
    { id: 'seed-milk', name: 'Leche entera', servingGrams: 200, kcal: 124, protein: 6.4, carbs: 9.6, fat: 6.8, sugar: 9.6, unit: 'ml' },
    { id: 'seed-rice', name: 'Arroz blanco cocido', servingGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, sugar: 0.1, unit: 'g' },
    { id: 'seed-chicken', name: 'Pechuga de pollo', servingGrams: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6, sugar: 0, unit: 'g' },
    { id: 'seed-oats', name: 'Avena', servingGrams: 40, kcal: 150, protein: 5, carbs: 27, fat: 3, sugar: 0.8, unit: 'g' },
  ];

  const exercises = [
    { id: 'ex-bench', name: 'Press de Banca Plano', muscleGroup: 'Pecho' },
    { id: 'ex-squat', name: 'Sentadilla con Barra', muscleGroup: 'Piernas' },
    { id: 'ex-deadlift', name: 'Peso Muerto', muscleGroup: 'Espalda' },
    { id: 'ex-run', name: 'Correr / Trote', muscleGroup: 'Cardio', type: 'time' },
    { id: 'ex-bike', name: 'Bicicleta / AirBike', muscleGroup: 'Cardio', type: 'time' },
    { id: 'ex-rower', name: 'Remo / Rower', muscleGroup: 'CrossFit', type: 'time' },
    { id: 'ex-burpee', name: 'Burpees / WOD', muscleGroup: 'CrossFit', type: 'time' },
    { id: 'ex-plank', name: 'Plancha Abdominal', muscleGroup: 'Core', type: 'time' },
    { id: 'ex-pullup', name: 'Dominadas', muscleGroup: 'Espalda' },
    { id: 'ex-military', name: 'Press Militar', muscleGroup: 'Hombros' },
    { id: 'ex-curl', name: 'Curl de Bíceps', muscleGroup: 'Brazos' },
    { id: 'ex-dips', name: 'Fondos en Paralelas', muscleGroup: 'Pecho' },
    { id: 'ex-press', name: 'Prensa de Piernas', muscleGroup: 'Piernas' },
  ];

  const supplements = [
    { id: 'supp-creatine', name: 'Creatina Monohidrato', dailyTarget: 1 },
    { id: 'supp-omega3', name: 'Omega 3', dailyTarget: 2 },
    { id: 'supp-magnesium', name: 'Citrato de Magnesio', dailyTarget: 2 },
    { id: 'supp-whey', name: 'Proteína Whey Aislada', dailyTarget: 1 },
  ];

  const healthMetrics = [
    { id: 'presion', name: 'Presión Arterial', unit: 'mmHg', icon: 'heart', color: '#EC4899', isDualValue: true, primaryLabel: 'Sistólica', secondaryLabel: 'Diastólica', idealRange: '120/80 mmHg' },
    { id: 'azucar', name: 'Glucosa en Sangre', unit: 'mg/dL', icon: 'water', color: '#8B5CF6', idealRange: '70 - 99 mg/dL' },
    { id: 'colesterol', name: 'Colesterol Total', unit: 'mg/dL', icon: 'analytics', color: '#3B82F6', idealRange: '< 200 mg/dL' },
    { id: 'trigliceridos', name: 'Triglicéridos', unit: 'mg/dL', icon: 'pulse', color: '#10B981', idealRange: '< 150 mg/dL' },
  ];

  // Estructuras de datos para 1 año (365 días)
  const logs: Record<string, any[]> = {};
  const workoutLogs: Record<string, any[]> = {};
  const weightLogs: Record<string, number> = {};
  const bodyFatLogs: Record<string, number> = {};
  const measurementLogs: Record<string, Record<string, number>> = {};
  const sleepLogs: Record<string, any> = {};
  const supplementLogs: Record<string, Record<string, boolean[]>> = {};
  const healthLogs: Record<string, any> = {};

  const now = new Date();
  const totalDays = 365;

  for (let i = totalDays; i >= 0; i--) {
    const curDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(curDate);
    const progress = (totalDays - i) / totalDays; // 0 -> 1
    const dayOfWeek = curDate.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab

    // 1. Peso y % Grasa (Evolución realista: recomposición corporal de 83.5 kg a 76.4 kg, y grasa de 20.2% a 14.8%)
    // Registrado casi a diario (90% de los días)
    if (i % 2 === 0 || i < 14) {
      const noiseW = ((curDate.getDate() % 5) - 2) * 0.15;
      const calculatedWeight = Math.round((83.5 - 7.1 * progress + noiseW) * 10) / 10;
      weightLogs[dateStr] = Math.max(74, calculatedWeight);

      const noiseF = ((curDate.getDate() % 3) - 1) * 0.1;
      const calculatedFat = Math.round((20.2 - 5.4 * progress + noiseF) * 10) / 10;
      bodyFatLogs[dateStr] = Math.max(13.5, calculatedFat);
    }

    // 2. Medidas Corporales (Registradas semanalmente cada domingo)
    if (dayOfWeek === 0 || i === 0) {
      measurementLogs[dateStr] = {
        chest: Math.round((95.0 + 9.5 * progress) * 10) / 10,       // 95 -> 104.5 cm
        back: Math.round((103.0 + 8.0 * progress) * 10) / 10,       // 103 -> 111 cm
        waist: Math.round((87.0 - 8.5 * progress) * 10) / 10,       // 87 -> 78.5 cm (reducción cintura)
        glutes: Math.round((94.5 + 4.2 * progress) * 10) / 10,      // 94.5 -> 98.7 cm (Glúteos)
        right_arm: Math.round((34.0 + 4.5 * progress) * 10) / 10,   // 34 -> 38.5 cm
        left_arm: Math.round((33.7 + 4.5 * progress) * 10) / 10,    // 33.7 -> 38.2 cm
        right_forearm: Math.round((27.5 + 3.0 * progress) * 10) / 10,
        left_forearm: Math.round((27.3 + 3.0 * progress) * 10) / 10,
        right_thigh: Math.round((54.5 + 6.0 * progress) * 10) / 10, // 54.5 -> 60.5 cm
        left_thigh: Math.round((54.2 + 6.0 * progress) * 10) / 10,
        right_calf: Math.round((36.5 + 2.0 * progress) * 10) / 10,
        left_calf: Math.round((36.3 + 2.0 * progress) * 10) / 10,
      };
    }

    // 3. Entrenamientos (4-5 días por semana con sobrecarga progresiva anual)
    // Lunes: Pecho & Tríceps
    // Martes: Espalda & Bíceps
    // Jueves: Piernas & Glúteos
    // Viernes: Hombros & Brazos
    // Sábado: CrossFit / Cardio
    if (dayOfWeek === 1) {
      // Lunes: Pecho
      const benchWeight = Math.round(55 + 30 * progress); // 55kg -> 85kg
      workoutLogs[dateStr] = [
        {
          id: `w-${dateStr}-1`,
          exerciseId: 'ex-bench',
          sets: [
            { id: 's1', weight: benchWeight - 10, reps: 10 },
            { id: 's2', weight: benchWeight - 5, reps: 8 },
            { id: 's3', weight: benchWeight, reps: 8 },
            { id: 's4', weight: benchWeight, reps: 6 },
          ],
        },
        {
          id: `w-${dateStr}-2`,
          exerciseId: 'ex-dips',
          sets: [
            { id: 's5', weight: Math.round(5 * progress), reps: 12 },
            { id: 's6', weight: Math.round(10 * progress), reps: 10 },
            { id: 's7', weight: Math.round(15 * progress), reps: 8 },
          ],
        },
      ];
    } else if (dayOfWeek === 2) {
      // Martes: Espalda
      const deadliftW = Math.round(75 + 50 * progress); // 75kg -> 125kg
      workoutLogs[dateStr] = [
        {
          id: `w-${dateStr}-1`,
          exerciseId: 'ex-deadlift',
          sets: [
            { id: 's1', weight: deadliftW - 20, reps: 8 },
            { id: 's2', weight: deadliftW - 10, reps: 6 },
            { id: 's3', weight: deadliftW, reps: 6 },
          ],
        },
        {
          id: `w-${dateStr}-2`,
          exerciseId: 'ex-pullup',
          sets: [
            { id: 's4', weight: Math.round(5 * progress), reps: 10 },
            { id: 's5', weight: Math.round(10 * progress), reps: 8 },
            { id: 's6', weight: Math.round(10 * progress), reps: 7 },
          ],
        },
      ];
    } else if (dayOfWeek === 4) {
      // Jueves: Piernas & Glúteos
      const squatW = Math.round(65 + 45 * progress); // 65kg -> 110kg
      const pressW = Math.round(120 + 70 * progress); // 120kg -> 190kg
      workoutLogs[dateStr] = [
        {
          id: `w-${dateStr}-1`,
          exerciseId: 'ex-squat',
          sets: [
            { id: 's1', weight: squatW - 20, reps: 10 },
            { id: 's2', weight: squatW - 10, reps: 8 },
            { id: 's3', weight: squatW, reps: 8 },
            { id: 's4', weight: squatW, reps: 6 },
          ],
        },
        {
          id: `w-${dateStr}-2`,
          exerciseId: 'ex-press',
          sets: [
            { id: 's5', weight: pressW - 20, reps: 12 },
            { id: 's6', weight: pressW, reps: 10 },
            { id: 's7', weight: pressW, reps: 10 },
          ],
        },
      ];
    } else if (dayOfWeek === 5) {
      // Viernes: Hombros & Brazos
      const militaryW = Math.round(32 + 23 * progress); // 32kg -> 55kg
      const curlW = Math.round(10 + 8 * progress); // 10kg -> 18kg
      workoutLogs[dateStr] = [
        {
          id: `w-${dateStr}-1`,
          exerciseId: 'ex-military',
          sets: [
            { id: 's1', weight: militaryW - 5, reps: 10 },
            { id: 's2', weight: militaryW, reps: 8 },
            { id: 's3', weight: militaryW, reps: 8 },
          ],
        },
        {
          id: `w-${dateStr}-2`,
          exerciseId: 'ex-curl',
          sets: [
            { id: 's4', weight: curlW - 2, reps: 12 },
            { id: 's5', weight: curlW, reps: 10 },
            { id: 's6', weight: curlW, reps: 10 },
          ],
        },
      ];
    } else if (dayOfWeek === 6) {
      // Sábado: Cardio / HIIT
      workoutLogs[dateStr] = [
        {
          id: `w-${dateStr}-1`,
          exerciseId: 'ex-run',
          sets: [
            { id: 's1', timeSeconds: 1500, distanceMeters: 4500 },
          ],
        },
        {
          id: `w-${dateStr}-2`,
          exerciseId: 'ex-plank',
          sets: [
            { id: 's2', timeSeconds: 90 },
            { id: 's3', timeSeconds: 90 },
            { id: 's4', timeSeconds: 90 },
          ],
        },
      ];
    }

    // 4. Comida y Nutrición Diaria (Desayuno, Almuerzo, Merienda, Cena)
    logs[dateStr] = [
      {
        id: `meal-${dateStr}-1`,
        name: 'Desayuno Power',
        items: [
          { ingredientId: 'seed-egg', grams: 3 },
          { ingredientId: 'seed-oats', grams: 60 },
          { ingredientId: 'seed-milk', grams: 200 },
        ],
      },
      {
        id: `meal-${dateStr}-2`,
        name: 'Almuerzo Anabólico',
        items: [
          { ingredientId: 'seed-chicken', grams: 200 },
          { ingredientId: 'seed-rice', grams: 220 },
        ],
      },
      {
        id: `meal-${dateStr}-3`,
        name: 'Merienda / Pre-Workout',
        items: [
          { ingredientId: 'seed-pb', grams: 35 },
          { ingredientId: 'seed-oats', grams: 40 },
        ],
      },
      {
        id: `meal-${dateStr}-4`,
        name: 'Cena de Recuperación',
        items: [
          { ingredientId: 'seed-chicken', grams: 180 },
          { ingredientId: 'seed-rice', grams: 160 },
          { ingredientId: 'seed-egg', grams: 1 },
        ],
      },
    ];

    // 5. Sueño y SmartBand
    const sleepHourBase = 7 + (curDate.getDate() % 2 === 0 ? 0.5 : 0.8);
    const deepH = Math.round((1.5 + (curDate.getDate() % 4) * 0.15) * 10) / 10;
    const lightH = Math.round((4.2 + (curDate.getDate() % 3) * 0.1) * 10) / 10;
    const remH = Math.round((1.4 + (curDate.getDate() % 3) * 0.1) * 10) / 10;
    const score = 84 + (curDate.getDate() % 12);
    const stepsVal = 8000 + (curDate.getDate() % 8) * 550;
    const calBurned = 500 + (curDate.getDate() % 6) * 45;

    sleepLogs[dateStr] = {
      hours: Math.floor(sleepHourBase),
      minutes: Math.round((sleepHourBase - Math.floor(sleepHourBase)) * 60),
      bedtime: '23:15',
      wakeTime: '07:05',
      deepSleepHours: deepH,
      lightSleepHours: lightH,
      remSleepHours: remH,
      awakeMinutes: 12 + (curDate.getDate() % 10),
      sleepScore: score,
      activeCaloriesBurned: calBurned,
      steps: stepsVal,
      restingHeartRate: 56 + (curDate.getDate() % 4),
      syncedFromDevice: true,
      deviceName: 'SmartBand Health Pro',
      source: 'apple_health',
      lastSyncedAt: 'Automático',
      qualityNote: 'Sueño de alta calidad con recuperación física óptima.',
    };

    // 6. Suplementos del Día (Adherencia ~92%)
    const isMissed = (curDate.getDate() === 13 || curDate.getDate() === 27);
    supplementLogs[dateStr] = {
      'supp-creatine': [!isMissed],
      'supp-omega3': [!isMissed, !isMissed],
      'supp-magnesium': [!isMissed, !isMissed],
      'supp-whey': [!isMissed],
    };

    // 7. Métricas de Salud / Biomarcadores (Semanal / Quincenal)
    if (curDate.getDate() % 14 === 1 || i === 0) {
      healthLogs[dateStr] = {
        presion: { value: 119, secondaryValue: 78, notes: 'Presión en reposo óptima' },
        azucar: { value: 91, notes: 'Glucosa en ayunas' },
        colesterol: { value: 174, notes: 'Perfil lipídico normal' },
        trigliceridos: { value: 128, notes: 'Triglicéridos dentro de rango' },
      };
    }
  }

  // 8. Perfil de Usuario con 1 año de racha y nivel avanzado
  const userProfile = {
    name,
    nickname,
    gender: 'male',
    activityLevel: 'very_active',
    targetKcal: 2450,
    targetProtein: 175,
    targetCarbs: 250,
    targetFat: 68,
    targetWaterMl: 3200,
    level: 42,
    xp: 2850,
    currentStreak: 48,
    bestStreak: 112,
    totalWorkouts: 248,
  };

  const recordsToSync: Record<string, any> = {
    ingredients,
    savedMeals: [],
    logs,
    exercises,
    workoutLogs,
    measurementLogs,
    weightLogs,
    bodyFatLogs,
    photoLogs: {},
    supplements,
    supplementLogs,
    healthMetrics,
    healthLogs,
    sleepLogs,
    userProfile,
    activePaletteId: 'default',
    customPalettes: [],
    deletedPaletteIds: [],
    typography: {
      titles: 'System',
      subtitles: 'System',
      body: 'System',
      data: 'System',
    },
    homeWidgets: {
      calories: true,
      macros: true,
      training: true,
      sleep: true,
      health: true,
      body: true,
    },
  };

  console.log(`Guardando dataRecords en la base de datos...`);

  const updates = Object.entries(recordsToSync).map(([dataType, payload]) => {
    const payloadStr = JSON.stringify(payload);
    return prisma.userData.upsert({
      where: {
        userId_dataType: { userId: user.id, dataType },
      },
      create: {
        userId: user.id,
        dataType,
        payload: payloadStr,
      },
      update: {
        payload: payloadStr,
      },
    });
  });

  await prisma.$transaction(updates);

  console.log(`=======================================================`);
  console.log(`✅ USUARIO DUMMY CREADO Y CARGADO CON ÉXITO:`);
  console.log(`   Email:      ${email}`);
  console.log(`   Password:   ${password}`);
  console.log(`   Historial:  365 días (1 año completo)`);
  console.log(`   - Comidas registradas:        ${Object.keys(logs).length} días`);
  console.log(`   - Entrenamientos registrados:  ${Object.keys(workoutLogs).length} días`);
  console.log(`   - Pesos corporales:           ${Object.keys(weightLogs).length} registros`);
  console.log(`   - % Grasa corporal:           ${Object.keys(bodyFatLogs).length} registros`);
  console.log(`   - Medidas antropométricas:    ${Object.keys(measurementLogs).length} semanas`);
  console.log(`   - Registros de sueño:         ${Object.keys(sleepLogs).length} noches`);
  console.log(`   - Registro de suplementos:    ${Object.keys(supplementLogs).length} días`);
  console.log(`   - Biomarcadores / Salud:      ${Object.keys(healthLogs).length} chequeos`);
  console.log(`=======================================================`);
}

main()
  .catch((e) => {
    console.error('Error al poblar usuario dummy:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
