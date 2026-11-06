import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'evolve_secret_fallback_key';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Helper: Generación de token JWT
function generateToken(user: { id: string; email: string }) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

// Middleware de Autenticación
interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autorización requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Helper opcional de autenticación (si hay token se decodifica, si no continúa sin error)
function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    } catch {
      // Ignorar token inválido en modo opcional
    }
  }
  next();
}

/* ==========================================================
   SEED DE ATLETAS DE LA COMUNIDAD EN BASE DE DATOS
========================================================== */
async function seedCommunityAthletes() {
  const athletes = [
    {
      email: 'carlos@evolve.app',
      name: 'Carlos Mendoza',
      nickname: 'carlos_fit',
      streak: 22,
      level: 28,
      rankTitle: 'Atleta Avanzado',
      totalXp: 4850,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      todayWorkout: 'Pecho & Tríceps (5 series pesadas)',
      metrics: {
        currentWeight: 81.2,
        bodyFat: 14.2,
        avgCalories: 2850,
        avgProtein: 180,
        prs: [
          { exercise: 'Press de Banca Plano', weight: 115, reps: 5, date: '2026-10-24' },
          { exercise: 'Sentadilla Trasera', weight: 150, reps: 4, date: '2026-10-18' },
          { exercise: 'Peso Muerto Convencional', weight: 180, reps: 3, date: '2026-10-10' },
          { exercise: 'Press Militar de Pie', weight: 75, reps: 6, date: '2026-10-05' },
        ],
        recentWorkouts: [
          { id: 'w-cm-1', date: 'Ayer', title: 'Pecho & Tríceps Pesado', durationMinutes: 65, exercises: ['Press de Banca Plano', 'Fondos Lastrados', 'Press Inclinado', 'Extensiones Polea'], totalSets: 18 },
          { id: 'w-cm-2', date: 'Hace 3 días', title: 'Espalda & Jalones', durationMinutes: 70, exercises: ['Dominadas Lastradas', 'Remo con Barra', 'Jalón al Pecho', 'Face Pulls'], totalSets: 20 },
        ],
        activeGoal: 'Superar los 120 kg en Press de Banca antes de fin de año',
      },
    },
    {
      email: 'valen@evolve.app',
      name: 'Valentina Ortiz',
      nickname: 'valen_lift',
      streak: 18,
      level: 32,
      rankTitle: 'Atleta Élite',
      totalXp: 6200,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      todayWorkout: 'Sentadillas & Glúteos (PR 105 kg)',
      metrics: {
        currentWeight: 62.0,
        bodyFat: 19.5,
        avgCalories: 2200,
        avgProtein: 135,
        prs: [
          { exercise: 'Hip Thrust con Barra', weight: 165, reps: 8, date: '2026-10-28' },
          { exercise: 'Sentadilla Profunda', weight: 105, reps: 5, date: '2026-10-22' },
          { exercise: 'Peso Muerto Rumano', weight: 110, reps: 6, date: '2026-10-15' },
        ],
        recentWorkouts: [
          { id: 'w-vo-1', date: 'Hoy', title: 'Glúteos & Isquios Foco PR', durationMinutes: 60, exercises: ['Hip Thrust', 'Sentadilla Búlgara', 'Peso Muerto Rumano'], totalSets: 17 },
        ],
        activeGoal: 'Alcanzar 180 kg en Hip Thrust con técnica perfecta',
      },
    },
    {
      email: 'mateo@evolve.app',
      name: 'Mateo Silva',
      nickname: 'mateo_iron',
      streak: 14,
      level: 16,
      rankTitle: 'Guerrero del Gym',
      totalXp: 2900,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      todayWorkout: 'Espalda & Jalones Foco Dorsal',
      metrics: {
        currentWeight: 75.0,
        bodyFat: 16.0,
        avgCalories: 2500,
        avgProtein: 150,
        prs: [
          { exercise: 'Remo con Barra 90°', weight: 90, reps: 8, date: '2026-10-26' },
          { exercise: 'Dominadas Supinas Lastre', weight: 25, reps: 5, date: '2026-10-20' },
        ],
        recentWorkouts: [
          { id: 'w-ms-1', date: 'Hoy', title: 'Espalda & Bíceps Hipertrofia', durationMinutes: 55, exercises: ['Dominadas', 'Remo con Mancuerna', 'Curl con Barra Z'], totalSets: 16 },
        ],
        activeGoal: 'Dominar 10 dominadas con +30 kg de lastre',
      },
    },
    {
      email: 'andres@evolve.app',
      name: 'Andrés Gómez',
      nickname: 'andres_beast',
      streak: 30,
      level: 35,
      rankTitle: 'Titán Evolve',
      totalXp: 7400,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      todayWorkout: 'Full Body Funcional & Potencia',
      metrics: {
        currentWeight: 84.5,
        bodyFat: 12.8,
        avgCalories: 3100,
        avgProtein: 195,
        prs: [
          { exercise: 'Clean & Jerk', weight: 110, reps: 1, date: '2026-10-25' },
          { exercise: 'Snatch Olímpico', weight: 85, reps: 1, date: '2026-10-15' },
        ],
        recentWorkouts: [
          { id: 'w-ag-1', date: 'Hoy', title: 'Fuerza Explosiva & Levantamientos', durationMinutes: 75, exercises: ['Clean & Jerk', 'Snatch', 'Sentadilla Frontal'], totalSets: 18 },
        ],
        activeGoal: 'Superar 120 kg en Clean & Jerk',
      },
    },
    {
      email: 'laura@evolve.app',
      name: 'Laura Restrepo',
      nickname: 'lau_wod',
      streak: 12,
      level: 20,
      rankTitle: 'Master Cross',
      totalXp: 3800,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      todayWorkout: 'WOD Fran & Gimnásticos (Sub 3 min)',
      metrics: {
        currentWeight: 58.5,
        bodyFat: 18.2,
        avgCalories: 2100,
        avgProtein: 130,
        prs: [
          { exercise: 'Thrusters WOD', weight: 45, reps: 21, date: '2026-10-20' },
          { exercise: 'Bar Muscle Ups', weight: 0, reps: 8, date: '2026-10-10' },
        ],
        recentWorkouts: [
          { id: 'w-lr-1', date: 'Ayer', title: 'Gimnásticos & Condicionamiento', durationMinutes: 50, exercises: ['Bar Muscle Ups', 'Handstand Walk', 'Row 2000m'], totalSets: 15 },
        ],
        activeGoal: 'Bajar de 2:45 en WOD Fran',
      },
    },
  ];

  try {
    for (const a of athletes) {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email: a.email }, { nickname: a.nickname }],
        },
      });

      const dummyHash = await bcrypt.hash('evolve123456', 8);

      if (!existing) {
        const created = await prisma.user.create({
          data: {
            email: a.email,
            passwordHash: dummyHash,
            name: a.name,
            nickname: a.nickname,
            streak: a.streak,
            level: a.level,
            rankTitle: a.rankTitle,
            totalXp: a.totalXp,
            avatarUrl: a.avatarUrl,
            provider: 'email',
          },
        });

        // Guardar métricas base en UserData
        await prisma.userData.create({
          data: {
            userId: created.id,
            dataType: 'metrics',
            payload: JSON.stringify(a.metrics),
          },
        });
      } else {
        // Actualizar estadísticas comunitarias si están en valores iniciales
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash: dummyHash,
            streak: Math.max(existing.streak, a.streak),
            level: Math.max(existing.level, a.level),
            rankTitle: existing.rankTitle === 'Iniciado Fitness' ? a.rankTitle : existing.rankTitle,
            totalXp: Math.max(existing.totalXp, a.totalXp),
            avatarUrl: existing.avatarUrl || a.avatarUrl,
          },
        });

        await prisma.userData.upsert({
          where: { userId_dataType: { userId: existing.id, dataType: 'metrics' } },
          create: {
            userId: existing.id,
            dataType: 'metrics',
            payload: JSON.stringify(a.metrics),
          },
          update: {
            payload: JSON.stringify(a.metrics),
          },
        });
      }
    }
  } catch (err) {
    console.warn('Advertencia durante seed de comunidad:', err);
  }
}

/* ==========================================================
   RUTAS DE SALUD DEL SERVIDOR
========================================================== */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Servidor Backend de Evolve activo y funcionando',
    timestamp: new Date().toISOString(),
  });
});

/* ==========================================================
   RUTAS DE AUTENTICACIÓN
========================================================== */

// 1. REGISTRO CON CORREO Y CONTRASEÑA
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, nickname, gender, height, birthDate, age } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Correo, contraseña y nombre son obligatorios.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const cleanNick = String(nickname || '').trim().replace('@', '');
    if (!cleanNick) {
      return res.status(400).json({ error: 'El apodo o nickname es obligatorio.' });
    }
    if (cleanNick.length < 3) {
      return res.status(400).json({ error: 'El apodo debe tener al menos 3 caracteres.' });
    }

    // Verificar si el nickname ya existe (búsqueda insensible a mayúsculas)
    const existingNickUser = await prisma.$queryRaw<Array<{ id: string; nickname: string }>>`
      SELECT id, nickname FROM "User" WHERE LOWER(nickname) = LOWER(${cleanNick}) LIMIT 1
    `;
    if (existingNickUser && existingNickUser.length > 0) {
      return res.status(400).json({
        error: `El nickname "@${cleanNick}" ya está en uso por otro atleta. Por favor elige otro apodo.`,
      });
    }

    const heightNum = typeof height === 'number' ? height : (parseFloat(height) || 175);
    const ageNum = typeof age === 'number' ? age : (parseInt(age, 10) || 24);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        name: String(name).trim(),
        nickname: cleanNick,
        provider: 'email',
        streak: 0,
        level: 1,
        rankTitle: 'Iniciado Fitness',
        totalXp: 0,
      },
    });

    // Guardar perfil inicial con género, altura, fecha de nacimiento y edad
    const userProfilePayload = {
      name: String(name).trim(),
      nickname: cleanNick,
      gender: gender || 'Masculino',
      height: heightNum,
      birthDate: birthDate || undefined,
      age: ageNum,
    };

    try {
      await prisma.userData.create({
        data: {
          userId: user.id,
          dataType: 'userProfile',
          payload: JSON.stringify(userProfilePayload),
        },
      });
    } catch (e) {
      console.warn('Advertencia al crear registro de userProfile inicial:', e);
    }

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
        totalXp: user.totalXp,
        createdAt: user.createdAt,
      },
      userProfile: userProfilePayload,
    });
  } catch (error) {
    console.error('Error en /api/auth/register:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar usuario.' });
  }
});

// COMPROBAR DISPONIBILIDAD DE NICKNAME
app.get('/api/auth/check-nickname', async (req: Request, res: Response) => {
  try {
    const rawNick = req.query.nickname;
    if (!rawNick) {
      return res.status(400).json({ available: false, error: 'Nickname no proporcionado.' });
    }
    const cleanNick = String(rawNick).trim().replace('@', '');
    if (cleanNick.length < 3) {
      return res.json({ available: false, message: 'El apodo debe tener al menos 3 caracteres.' });
    }
    const matches = await prisma.$queryRaw<Array<{ id: string; nickname: string }>>`
      SELECT id, nickname FROM "User" WHERE LOWER(nickname) = LOWER(${cleanNick}) LIMIT 1
    `;
    const available = !matches || matches.length === 0;
    return res.json({
      available,
      nickname: cleanNick,
      message: available ? 'Apodo disponible' : `El apodo "@${cleanNick}" ya está en uso.`,
    });
  } catch (error) {
    console.error('Error en /api/auth/check-nickname:', error);
    return res.status(500).json({ error: 'Error al comprobar disponibilidad del apodo.' });
  }
});

// COMPROBAR EXISTENCIA DE CORREO
app.get('/api/auth/check-email', async (req: Request, res: Response) => {
  try {
    const rawEmail = req.query.email;
    if (!rawEmail) {
      return res.status(400).json({ error: 'Correo no proporcionado.' });
    }
    const cleanEmail = String(rawEmail).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, name: true, nickname: true, provider: true },
    });
    return res.json({
      exists: !!user,
      user: user || null,
    });
  } catch (error) {
    console.error('Error en /api/auth/check-email:', error);
    return res.status(500).json({ error: 'Error al verificar correo.' });
  }
});

// Almacén en memoria para códigos de recuperación de contraseña (con expiración de 15 minutos)
const passwordResetCodes = new Map<string, { code: string; expiresAt: number }>();

// 2.1 SOLICITAR CÓDIGO DE RECUPERACIÓN DE CONTRASEÑA
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Ingresa tu correo electrónico registrado.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      return res.status(404).json({ error: 'No existe una cuenta registrada con este correo electrónico.' });
    }

    // Generar código numérico de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    passwordResetCodes.set(cleanEmail, { code: resetCode, expiresAt });

    console.log(`🔑 Código de recuperación generado para ${cleanEmail}: ${resetCode}`);

    return res.json({
      success: true,
      message: 'Código de recuperación generado exitosamente.',
      email: cleanEmail,
      resetCode, // Proporcionado para permitir verificación inmediata en el dispositivo
    });
  } catch (error) {
    console.error('Error en /api/auth/forgot-password:', error);
    return res.status(500).json({ error: 'Error interno al procesar la solicitud de recuperación.' });
  }
});

// 2.2 RESTABLECER CONTRASEÑA CON CÓDIGO
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios (correo, código y nueva contraseña).' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const storedEntry = passwordResetCodes.get(cleanEmail);
    if (!storedEntry) {
      return res.status(400).json({ error: 'No hay ninguna solicitud de recuperación activa para este correo. Solicita un nuevo código.' });
    }

    if (Date.now() > storedEntry.expiresAt) {
      passwordResetCodes.delete(cleanEmail);
      return res.status(400).json({ error: 'El código de recuperación ha expirado. Por favor solicita uno nuevo.' });
    }

    if (storedEntry.code !== cleanCode) {
      return res.status(400).json({ error: 'El código de recuperación es incorrecto. Verifica los 6 dígitos ingresados.' });
    }

    // Verificar que el usuario exista
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Hashear y actualizar nueva contraseña
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({
      where: { email: cleanEmail },
      data: { passwordHash },
    });

    // Invalidar el código usado
    passwordResetCodes.delete(cleanEmail);

    console.log(`✅ Contraseña actualizada con éxito para: ${cleanEmail}`);

    return res.json({
      success: true,
      message: 'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión con tu nueva contraseña.',
    });
  } catch (error) {
    console.error('Error en /api/auth/reset-password:', error);
    return res.status(500).json({ error: 'Error interno al restablecer la contraseña.' });
  }
});

// 2. INICIO DE SESIÓN CON CORREO O NICKNAME Y CONTRASEÑA
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, identifier, nickname, password } = req.body;
    const rawInput = String(identifier || nickname || email || '').trim();

    if (!rawInput || !password) {
      return res.status(400).json({ error: 'Ingresa correo o nickname y contraseña.' });
    }

    const cleanInput = rawInput.toLowerCase();
    const cleanNick = cleanInput.startsWith('@') ? cleanInput.slice(1) : cleanInput;

    // Buscar por correo o nickname (con o sin @)
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanInput },
          { nickname: cleanNick },
          { nickname: `@${cleanNick}` },
        ],
      },
    });

    // Fallback insensible a mayúsculas para SQLite
    if (!user) {
      const allUsers = await prisma.user.findMany();
      user = allUsers.find((u) => {
        const uEmail = u.email ? u.email.trim().toLowerCase() : '';
        const uNick = u.nickname ? u.nickname.trim().toLowerCase().replace('@', '') : '';
        return uEmail === cleanInput || uNick === cleanNick;
      }) || null;
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo o nickname y contraseña.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo o nickname y contraseña.' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
        totalXp: user.totalXp,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    return res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
});

// 3. INICIO DE SESIÓN SOCIAL (GOOGLE / APPLE)
app.post('/api/auth/social', async (req: Request, res: Response) => {
  try {
    const { provider, providerId, email, name, avatarUrl } = req.body;

    if (!provider || !email) {
      return res.status(400).json({ error: 'Proveedor y correo son requeridos.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      // Si el usuario no existe en la base de datos, requerir el formulario de registro de atleta
      return res.json({
        isNewUser: true,
        message: 'Usuario no registrado. Completa tu perfil para acceder.',
        email: cleanEmail,
        name: name ? String(name).trim() : cleanEmail.split('@')[0],
        provider: provider === 'apple' ? 'apple' : 'google',
        providerId: providerId ? String(providerId) : undefined,
        avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
      });
    }

    // Si ya existe, actualizar providerId/avatar si aplica
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        providerId: providerId ? String(providerId) : user.providerId,
        avatarUrl: avatarUrl ? String(avatarUrl) : user.avatarUrl,
      },
    });

    // Obtener su userProfile si ya lo tiene guardado
    const profileRecord = await prisma.userData.findUnique({
      where: { userId_dataType: { userId: user.id, dataType: 'userProfile' } },
    });
    let parsedProfile = undefined;
    if (profileRecord?.payload) {
      try { parsedProfile = JSON.parse(profileRecord.payload); } catch {}
    }

    const token = generateToken(user);

    return res.json({
      isNewUser: false,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
        totalXp: user.totalXp,
        createdAt: user.createdAt,
      },
      userProfile: parsedProfile,
    });
  } catch (error) {
    console.error('Error en /api/auth/social:', error);
    return res.status(500).json({ error: 'Error interno al autenticar con proveedor social.' });
  }
});

// 3.1 REGISTRO SOCIAL CON DATOS BIOMÉTRICOS Y NICKNAME OBLIGATORIO
app.post('/api/auth/social-register', async (req: Request, res: Response) => {
  try {
    const { provider, providerId, email, name, nickname, gender, height, birthDate, age, avatarUrl } = req.body;

    if (!provider || !email || !name) {
      return res.status(400).json({ error: 'Proveedor, correo y nombre son requeridos.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    const cleanNick = String(nickname || '').trim().replace('@', '');
    if (!cleanNick) {
      return res.status(400).json({ error: 'El apodo o nickname es obligatorio.' });
    }
    if (cleanNick.length < 3) {
      return res.status(400).json({ error: 'El apodo debe tener al menos 3 caracteres.' });
    }

    // Verificar disponibilidad del nickname
    const existingNickUser = await prisma.$queryRaw<Array<{ id: string; nickname: string }>>`
      SELECT id, nickname FROM "User" WHERE LOWER(nickname) = LOWER(${cleanNick}) LIMIT 1
    `;
    if (existingNickUser && existingNickUser.length > 0) {
      return res.status(400).json({
        error: `El nickname "@${cleanNick}" ya está en uso por otro atleta. Por favor elige otro apodo.`,
      });
    }

    const heightNum = typeof height === 'number' ? height : (parseFloat(height) || 175);
    const ageNum = typeof age === 'number' ? age : (parseInt(age, 10) || 24);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: String(name).trim(),
        nickname: cleanNick,
        provider: provider === 'apple' ? 'apple' : 'google',
        providerId: providerId ? String(providerId) : undefined,
        avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
        streak: 0,
        level: 1,
        rankTitle: 'Iniciado Fitness',
        totalXp: 0,
      },
    });

    const userProfilePayload = {
      name: String(name).trim(),
      nickname: cleanNick,
      gender: gender || 'Masculino',
      height: heightNum,
      birthDate: birthDate || undefined,
      age: ageNum,
    };

    try {
      await prisma.userData.create({
        data: {
          userId: user.id,
          dataType: 'userProfile',
          payload: JSON.stringify(userProfilePayload),
        },
      });
    } catch (e) {
      console.warn('Advertencia al crear registro de userProfile en social-register:', e);
    }

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
        totalXp: user.totalXp,
        createdAt: user.createdAt,
      },
      userProfile: userProfilePayload,
    });
  } catch (error) {
    console.error('Error en /api/auth/social-register:', error);
    return res.status(500).json({ error: 'Error interno al registrar usuario con proveedor social.' });
  }
});

// 4. OBTENER PERFIL DEL USUARIO AUTENTICADO
app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
        totalXp: user.totalXp,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error en /api/auth/me:', error);
    return res.status(500).json({ error: 'Error al obtener datos del usuario.' });
  }
});

// 5. ACTUALIZAR PERFIL EN BASE DE DATOS
app.put('/api/auth/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { name, nickname, avatarUrl, streak, level, rankTitle, totalXp } = req.body;
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (nickname !== undefined) updateData.nickname = String(nickname).trim().replace('@', '');
    if (avatarUrl !== undefined) updateData.avatarUrl = String(avatarUrl).trim();
    if (typeof streak === 'number') updateData.streak = streak;
    if (typeof level === 'number') updateData.level = level;
    if (rankTitle !== undefined) updateData.rankTitle = String(rankTitle);
    if (typeof totalXp === 'number') updateData.totalXp = totalXp;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
        totalXp: user.totalXp,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error en /api/auth/profile:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil en la base de datos.' });
  }
});

// 6. LISTAR Y BUSCAR USUARIOS EN LA BASE DE DATOS
app.get('/api/users', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = req.query.q ? String(req.query.q).trim().toLowerCase().replace('@', '') : '';
    const currentUserId = req.user?.id;

    const users = await prisma.user.findMany({
      where: currentUserId ? { id: { not: currentUserId } } : undefined,
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        streak: true,
        level: true,
        rankTitle: true,
        totalXp: true,
      },
      take: 50,
    });

    const formatted = users.map((u) => {
      const cleanNick = u.nickname ? `@${u.nickname.replace('@', '')}` : `@${u.email.split('@')[0]}`;
      return {
        id: u.id,
        name: u.name,
        nickname: cleanNick,
        email: u.email,
        avatarUrl: u.avatarUrl,
        streak: u.streak || 0,
        level: u.level || 1,
        rank: u.rankTitle || 'Iniciado Fitness',
        totalXp: u.totalXp || 0,
      };
    });

    if (q) {
      return res.json({
        users: formatted.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.nickname.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
        ),
      });
    }

    return res.json({ users: formatted });
  } catch (error) {
    console.error('Error en /api/users:', error);
    return res.status(500).json({ error: 'Error al listar usuarios.' });
  }
});

/* ==========================================================
   PERFIL COMPLETO Y MÉTRICAS REALES DE LA BASE DE DATOS
========================================================== */
const BODY_PART_LABELS: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  right_arm: 'Brazo Derecho',
  left_arm: 'Brazo Izquierdo',
  right_forearm: 'Antebrazo Derecho',
  left_forearm: 'Antebrazo Izquierdo',
  waist: 'Cintura',
  right_thigh: 'Pierna Derecha',
  left_thigh: 'Pierna Izquierda',
  right_calf: 'Pantorrilla Derecha',
  left_calf: 'Pantorrilla Izquierda',
  glutes: 'Glúteos',
  shoulders: 'Hombros',
  neck: 'Cuello',
};

const STANDARD_EXERCISES: Record<string, string> = {
  'ex-bench': 'Press de Banca Plano',
  'ex-incline-bench': 'Press Inclinado con Mancuernas',
  'ex-decline-bench': 'Press Declinado',
  'ex-military': 'Press Militar con Barra',
  'ex-deadlift': 'Peso Muerto Convencional',
  'ex-squat': 'Sentadilla con Barra',
  'ex-pullup': 'Dominadas Pronas',
  'ex-barbell-row': 'Remo con Barra',
  'ex-bicep-curl': 'Curl de Bíceps con Barra Z',
  'ex-hammer-curl': 'Curl Martillo',
  'ex-tricep-pushdown': 'Extensión de Tríceps en Polea',
  'ex-leg-press': 'Prensa de Piernas 45°',
  'ex-run': 'Correr / Trote',
  'ex-bike': 'Bicicleta / AirBike',
  'ex-rower': 'Remo / Rower',
  'ex-burpee': 'Burpees',
  'ex-dips': 'Fondos en Paralelas',
  'ex-lateral-raise': 'Elevaciones Laterales',
  'ex-plank': 'Plancha Abdominal',
  'ex-pushup': 'Flexiones de Pecho',
  'ex-lat-pulldown': 'Jalón al Pecho',
  'ex-leg-extension': 'Extensiones de Cuádriceps',
  'ex-hamstring-curl': 'Curl Femoral',
  'ex-calf-raise': 'Elevaciones de Talones',
};

const ALL_PRESET_PALETTES: Record<string, {
  name: string;
  primary: string;
  secondary: string;
  cardBg: string;
  bg: string;
  isDark: boolean;
}> = {
  default: {
    name: 'Anime Pastel',
    primary: '#8B5CF6',
    secondary: '#F472B6',
    cardBg: '#FFFFFF',
    bg: '#F3F5FA',
    isDark: false,
  },
  dark: {
    name: 'Modo Nocturno (Midnight)',
    primary: '#818CF8',
    secondary: '#EC4899',
    cardBg: '#1E293B',
    bg: '#0F172A',
    isDark: true,
  },
  sunset: {
    name: 'Atardecer Cálido',
    primary: '#FB7185',
    secondary: '#F59E0B',
    cardBg: '#FFFFFF',
    bg: '#FFF7ED',
    isDark: false,
  },
  emerald: {
    name: 'Menta & Esmeralda',
    primary: '#10B981',
    secondary: '#06B6D4',
    cardBg: '#FFFFFF',
    bg: '#F0FDF4',
    isDark: false,
  },
  cyberpunk: {
    name: 'Cyberpunk Neón',
    primary: '#06B6D4',
    secondary: '#EC4899',
    cardBg: '#27272A',
    bg: '#18181B',
    isDark: true,
  },
  ocean: {
    name: 'Océano Profundo',
    primary: '#3B82F6',
    secondary: '#2DD4BF',
    cardBg: '#FFFFFF',
    bg: '#F0F9FF',
    isDark: false,
  },
  crimson: {
    name: 'Fuego Carmesí',
    primary: '#DC2626',
    secondary: '#EA580C',
    cardBg: '#FFFFFF',
    bg: '#FEF2F2',
    isDark: false,
  },
};

function calculateGoalProgress(goal: any): number {
  if (goal.completed) return 100;
  const cur = Number(goal.currentValue);
  const start = Number(goal.startValue);
  const target = Number(goal.targetValue);
  if (isNaN(cur) || isNaN(target)) return 0;
  if (goal.type === 'calories') {
    if (target > 0) return Math.min(100, Math.max(0, Math.round((cur / target) * 100)));
    return 0;
  }
  if (!isNaN(start) && target !== start) {
    if (target > start) {
      const p = Math.round(((cur - start) / (target - start)) * 100);
      return Math.min(100, Math.max(0, p));
    } else {
      const p = Math.round(((start - cur) / (start - target)) * 100);
      return Math.min(100, Math.max(0, p));
    }
  }
  if (target > 0) {
    return Math.min(100, Math.max(0, Math.round((cur / target) * 100)));
  }
  return 0;
}

function buildFriendFullProfile(user: any, records: Record<string, any>) {
  // 1. Personalización y Paleta Real del Usuario
  const rawPaletteId = records.activePaletteId !== undefined ? String(records.activePaletteId).trim() : 'default';
  const customPalettes = Array.isArray(records.customPalettes) ? records.customPalettes : [];
  const foundCustom = customPalettes.find((cp: any) => cp && cp.id === rawPaletteId);

  let pal = ALL_PRESET_PALETTES[rawPaletteId];
  if (foundCustom) {
    pal = {
      name: foundCustom.name || 'Personalizada',
      primary: foundCustom.primary || (foundCustom.colors && foundCustom.colors[0]) || '#8B5CF6',
      secondary: foundCustom.secondary || (foundCustom.colors && foundCustom.colors[1]) || '#EC4899',
      cardBg: foundCustom.cardBg || (foundCustom.isDark ? '#1E293B' : '#FFFFFF'),
      bg: foundCustom.bg || (foundCustom.isDark ? '#0F172A' : '#F3F5FA'),
      isDark: Boolean(foundCustom.isDark),
    };
  } else if (!pal) {
    const lowerId = rawPaletteId.toLowerCase();
    const foundPresetKey = Object.keys(ALL_PRESET_PALETTES).find((k) => k.toLowerCase() === lowerId);
    pal = foundPresetKey ? ALL_PRESET_PALETTES[foundPresetKey] : ALL_PRESET_PALETTES.default;
  }

  const typography = records.typography?.titles || 'athletic';

  // 2. Privacidad
  const privacy = records.privacySettings || {
    home: true,
    workout: true,
    food: true,
    wellness: true,
    measurements: true,
  };

  // 3. Info Básica, Racha, Nivel y Experiencia Calculados en Tiempo Real
  const workoutLogs = records.workoutLogs && typeof records.workoutLogs === 'object' ? records.workoutLogs : {};
  const trainedDates = Object.entries(workoutLogs)
    .filter(([_, exercises]) => Array.isArray(exercises) && exercises.length > 0)
    .map(([date]) => date)
    .sort();

  let streak = 0;
  if (trainedDates.length > 0) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const lastDateStr = trainedDates[trainedDates.length - 1];
    const lastWorkoutDate = new Date(`${lastDateStr}T12:00:00`);
    const diffMs = today.getTime() - lastWorkoutDate.getTime();
    const daysSinceLast = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (daysSinceLast <= 5) {
      streak = 1;
      for (let i = trainedDates.length - 1; i > 0; i--) {
        const cur = new Date(`${trainedDates[i]}T12:00:00`);
        const prev = new Date(`${trainedDates[i - 1]}T12:00:00`);
        const gapDays = Math.round((cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (gapDays <= 5) streak++;
        else break;
      }
    }
  }

  // Cálculo de XP real a partir de todas las actividades registradas
  let totalXp = 0;
  // Entrenamientos
  Object.values(workoutLogs).forEach((sessions: any) => {
    if (Array.isArray(sessions) && sessions.length > 0) {
      totalXp += 25;
      sessions.forEach((s: any) => {
        const setsCount = Array.isArray(s.sets) ? s.sets.length : 1;
        totalXp += 8 + setsCount * 2;
      });
    }
  });

  // Nutrición
  const mealLogs = records.logs && typeof records.logs === 'object' ? records.logs : {};
  Object.values(mealLogs).forEach((meals: any) => {
    if (Array.isArray(meals) && meals.length > 0) totalXp += 15;
  });

  // Sueño
  const sleepLogs = records.sleepLogs && typeof records.sleepLogs === 'object' ? records.sleepLogs : {};
  Object.keys(sleepLogs).forEach(() => { totalXp += 10; });

  // Suplementos
  const rawSupplements = Array.isArray(records.supplements) ? records.supplements : [];
  const supplementLogs = records.supplementLogs && typeof records.supplementLogs === 'object' ? records.supplementLogs : {};
  Object.values(supplementLogs).forEach((dayMap: any) => {
    if (dayMap && typeof dayMap === 'object') {
      let count = 0;
      Object.values(dayMap).forEach((arr: any) => {
        if (Array.isArray(arr)) count += arr.filter(Boolean).length;
      });
      totalXp += count * 4;
    }
  });

  // Metas completadas
  const rawGoals = Array.isArray(records.goals) ? records.goals : [];
  rawGoals.forEach((g: any) => {
    if (g && g.completed) totalXp += 150;
  });

  // Medidas corporales
  const measurementLogs = records.measurementLogs && typeof records.measurementLogs === 'object' ? records.measurementLogs : {};
  Object.keys(measurementLogs).forEach(() => { totalXp += 12; });

  if (typeof user.totalXp === 'number' && user.totalXp > totalXp) {
    totalXp = user.totalXp;
  }
  if (typeof user.streak === 'number' && user.streak > streak) {
    streak = user.streak;
  }

  // Curva de niveles progresiva (idéntica a HomeScreen): L requiere 140 + (L-1)*45 XP
  let level = 1;
  let remainingXp = totalXp;
  let neededForCurrent = 140;
  while (remainingXp >= neededForCurrent) {
    remainingXp -= neededForCurrent;
    level++;
    neededForCurrent = 140 + (level - 1) * 45;
  }

  if (typeof user.level === 'number' && user.level > level) {
    level = user.level;
  }

  let rank = 'Iniciado Fitness';
  if (level >= 100) rank = 'Leyenda Evolve';
  else if (level >= 90) rank = 'Deidad del Hierro';
  else if (level >= 80) rank = 'Inmortal de Acero';
  else if (level >= 70) rank = 'Semidiós del Fitness';
  else if (level >= 60) rank = 'Coloso Indomable';
  else if (level >= 50) rank = 'Maestro del Olimpo';
  else if (level >= 40) rank = 'Titán del Hierro';
  else if (level >= 30) rank = 'Atleta Élite';
  else if (level >= 20) rank = 'Atleta Avanzado';
  else if (level >= 10) rank = 'Guerrero del Gym';
  else if (level >= 5) rank = 'Atleta Dedicado';

  if (user.rankTitle && user.rankTitle !== 'Atleta Evolve' && user.rankTitle !== 'Iniciado Fitness') {
    rank = user.rankTitle;
  }

  const xp = remainingXp;
  const nextLevelXp = neededForCurrent;

  // 4. Metas Reales desde la BD (filtrar activas y calcular progreso real)
  const activeRawGoals = rawGoals.filter((g: any) => !g.completed);

  const activeGoals = activeRawGoals.map((g: any, idx: number) => {
    const progress = calculateGoalProgress(g);
    let cat = g.categoryLabel;
    if (!cat) {
      switch (g.type) {
        case 'weight': cat = 'Peso Corporal'; break;
        case 'body_fat': cat = '% Grasa Corporal'; break;
        case 'pr': cat = g.exerciseName ? `PR: ${g.exerciseName}` : 'Récord / PR'; break;
        case 'muscle': cat = 'Medida Muscular'; break;
        case 'calories': cat = 'Calorías Diarias'; break;
        default: cat = 'Objetivo Personal'; break;
      }
    }
    return {
      id: g.id || `goal-${idx}`,
      title: g.title || 'Meta de Entrenamiento',
      progress,
      targetDate: g.targetDate || 'Sin fecha límite',
      category: cat,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit || '',
    };
  });

  const completedGoalsCount = rawGoals.filter((g: any) => g.completed).length;

  // 5. Entrenamientos y PRs Reales de la BD
  const exerciseList = Array.isArray(records.exercises) ? records.exercises : [];
  const exerciseMap = new Map<string, string>();
  exerciseList.forEach((e: any) => {
    if (e.id && e.name) exerciseMap.set(e.id, e.name);
  });

  const getExerciseName = (exId: string) => {
    if (exerciseMap.has(exId)) return exerciseMap.get(exId)!;
    if (STANDARD_EXERCISES[exId]) return STANDARD_EXERCISES[exId];
    return exId;
  };

  const prMap = new Map<string, { weight: number; reps: number; date: string }>();
  const recentWorkouts: any[] = [];
  const sortedDates = Object.keys(workoutLogs).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    const daySessions = workoutLogs[date];
    if (Array.isArray(daySessions)) {
      const dayExercises: string[] = [];
      for (const sess of daySessions) {
        const exName = getExerciseName(sess.exerciseId || sess.name || 'Ejercicio');
        if (!dayExercises.includes(exName)) dayExercises.push(exName);

        if (Array.isArray(sess.sets)) {
          for (const s of sess.sets) {
            const w = Number(s.weight) || 0;
            const r = Number(s.reps) || 0;
            const existing = prMap.get(exName);
            if (!existing || w > existing.weight || (w === existing.weight && r > existing.reps)) {
              prMap.set(exName, { weight: w, reps: r, date });
            }
          }
        }
      }

      if (dayExercises.length > 0) {
        recentWorkouts.push({
          id: `w-${date}`,
          date,
          title: `Sesión de ${dayExercises[0]}`,
          durationMinutes: 45 + Math.min(45, dayExercises.length * 10),
          exercises: dayExercises,
        });
      }
    }
  }

  const prs = Array.from(prMap.entries()).map(([exercise, data]) => ({
    exercise,
    weight: data.weight,
    reps: data.reps,
    date: data.date,
  }));

  // 6. Nutrición y Comidas Reales de la BD
  const ingredientsList = Array.isArray(records.ingredients) ? records.ingredients : [];
  const ingMap = new Map<string, any>();
  ingredientsList.forEach((ing: any) => {
    if (ing.id) ingMap.set(ing.id, ing);
  });

  const sortedMealDates = Object.keys(mealLogs).sort((a, b) => b.localeCompare(a));
  const latestMealDate = sortedMealDates[0];
  const loggedMealsToday: any[] = [];
  let totalKcalToday = 0;
  let totalProtToday = 0;

  if (latestMealDate && Array.isArray(mealLogs[latestMealDate])) {
    for (const meal of mealLogs[latestMealDate]) {
      let mealKcal = 0;
      let mealProt = 0;
      if (Array.isArray(meal.items)) {
        for (const item of meal.items) {
          const ing = ingMap.get(item.ingredientId);
          if (ing && ing.servingGrams && item.grams) {
            const factor = item.grams / ing.servingGrams;
            mealKcal += Math.round((ing.kcal || 0) * factor);
            mealProt += Math.round((ing.protein || 0) * factor);
          } else if (item.kcal || item.calories) {
            mealKcal += Number(item.kcal || item.calories || 0);
            mealProt += Number(item.protein || 0);
          }
        }
      }
      totalKcalToday += mealKcal;
      totalProtToday += mealProt;

      loggedMealsToday.push({
        name: meal.name || 'Comida',
        calories: mealKcal,
        protein: mealProt,
      });
    }
  }

  const weightLogs = records.weightLogs && typeof records.weightLogs === 'object' ? records.weightLogs : {};
  const weightDates = Object.keys(weightLogs).sort();
  const currentWeight = weightDates.length > 0 ? Number(weightLogs[weightDates[weightDates.length - 1]]) : (Number(records.userProfile?.weight) || 70);
  const startWeight = weightDates.length > 0 ? Number(weightLogs[weightDates[0]]) : currentWeight;
  const targetWeight = Number(records.userProfile?.targetWeight) || currentWeight;

  const bodyFatLogs = records.bodyFatLogs && typeof records.bodyFatLogs === 'object' ? records.bodyFatLogs : {};
  const fatDates = Object.keys(bodyFatLogs).sort();
  const currentBodyFat = fatDates.length > 0 ? Number(bodyFatLogs[fatDates[fatDates.length - 1]]) : (Number(records.userProfile?.bodyFat) || 0);

  const waterLogs = records.waterLogs && typeof records.waterLogs === 'object' ? records.waterLogs : {};
  const todayWater = latestMealDate && waterLogs[latestMealDate] ? Number(waterLogs[latestMealDate]) : 0;

  const targetCalories = records.userProfile?.height && records.userProfile?.gender
    ? Math.round(10 * currentWeight + 6.25 * Number(records.userProfile.height) - 5 * (Number(records.userProfile.age) || 25) + (records.userProfile.gender === 'Femenino' ? -161 : 5) + 500)
    : 2450;

  // 7. Bienestar y Sueño Reales de la BD
  const sleepEntries = Object.values(sleepLogs);
  let avgSleepHours = 0;
  if (sleepEntries.length > 0) {
    const totalHours = sleepEntries.reduce((sum: number, entry: any) => {
      const h = Number(entry.hours) || 0;
      const m = Number(entry.minutes) || 0;
      return sum + h + (m / 60);
    }, 0);
    avgSleepHours = Math.round((totalHours / sleepEntries.length) * 10) / 10;
  }

  const activeSupplements = rawSupplements.map((s: any) => {
    const takenToday = Boolean(supplementLogs[latestMealDate || '']?.[s.id]?.some((v: any) => Boolean(v)));
    return {
      name: s.name,
      dosage: `${s.dailyTarget || 1} ${s.dailyTarget === 1 ? 'dosis' : 'tomas'} / día`,
      takenToday,
    };
  });

  // 8. Medidas Corporales Reales de la BD
  const muscles: { part: string; cm: number }[] = [];
  const measurementDates = Object.keys(measurementLogs).sort((a, b) => b.localeCompare(a));
  const seenParts = new Set<string>();

  for (const d of measurementDates) {
    const dayMeasures = measurementLogs[d];
    if (dayMeasures && typeof dayMeasures === 'object') {
      for (const [key, val] of Object.entries(dayMeasures)) {
        if (!seenParts.has(key) && Number(val) > 0) {
          seenParts.add(key);
          muscles.push({
            part: BODY_PART_LABELS[key] || key,
            cm: Number(val),
          });
        }
      }
    }
  }

  const routinesList = Array.isArray(records.routines) ? records.routines : [];
  const routineNames = routinesList.map((r: any) => r.name || r.title).filter(Boolean);
  const division = routineNames.length > 0
    ? routineNames.slice(0, 3).join(' / ')
    : (Object.keys(workoutLogs).length > 0 ? 'Entrenamiento Libre' : 'Sin rutina activa');

  return {
    customization: {
      palette: pal,
      font: typography,
      avatarIcon: 'flame',
    },
    privacy,
    home: {
      streak,
      level,
      rank,
      xp,
      nextLevelXp,
      activeGoals,
      completedGoalsCount,
    },
    workout: {
      division,
      weeklyFrequency: Math.min(7, Object.keys(workoutLogs).length),
      prs,
      recentWorkouts,
    },
    food: {
      targetCalories,
      macros: {
        protein: currentWeight > 0 ? Math.round(currentWeight * 2) : 0,
        carbs: targetCalories > 0 ? Math.round((targetCalories * 0.45) / 4) : 0,
        fat: targetCalories > 0 ? Math.round((targetCalories * 0.25) / 9) : 0,
      },
      waterLiters: todayWater > 0 ? Math.round(todayWater * 10) / 10 : 0,
      loggedMealsToday,
    },
    wellness: {
      avgSleepHours,
      sleepQuality: sleepEntries.length === 0 ? 'Sin registros' : (avgSleepHours >= 7 ? 'Óptima' : 'Moderada'),
      activeSupplements,
    },
    measurements: {
      currentWeight,
      startWeight,
      targetWeight,
      bodyFat: currentBodyFat,
      muscles,
    },
  };
}

// ENDPOINT PARA OBTENER EL PERFIL COMPLETO REAL DE UN USUARIO / AMIGO
app.get('/api/users/:target/full-profile', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    const { target } = req.params;
    if (!target) return res.status(400).json({ error: 'Falta identificador de usuario' });

    const cleanTarget = String(target).trim().replace('@', '');
    const lowerClean = cleanTarget.toLowerCase();

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: target },
          { id: cleanTarget },
          { nickname: cleanTarget },
          { nickname: lowerClean },
          { email: lowerClean },
        ],
      },
      include: {
        dataRecords: true,
      },
    });

    if (!user) {
      // Fallback robusto en memoria insensible a mayúsculas/minúsculas para SQLite
      const allUsers = await prisma.user.findMany({ include: { dataRecords: true } });
      user = allUsers.find(
        (u) =>
          u.id === target ||
          u.id === cleanTarget ||
          (u.nickname && u.nickname.toLowerCase() === lowerClean) ||
          (u.email && u.email.toLowerCase() === lowerClean)
      ) || null;
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const records: Record<string, any> = {};
    for (const r of user.dataRecords) {
      try {
        records[r.dataType] = JSON.parse(r.payload);
      } catch {
        records[r.dataType] = r.payload;
      }
    }

    const fullProfile = buildFriendFullProfile(user, records);

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname ? `@${user.nickname.replace('@', '')}` : '',
        avatarUrl: user.avatarUrl,
        streak: user.streak,
        level: user.level,
        rankTitle: user.rankTitle,
      },
      fullProfile,
    });
  } catch (error) {
    console.error('Error en /api/users/:target/full-profile:', error);
    return res.status(500).json({ error: 'Error al obtener el perfil completo del usuario.' });
  }
});

/* ==========================================================
   RUTAS DE AMIGOS & COMUNIDAD (PILLAR 3: SOCIAL DATABASE)
========================================================== */

// 1. ENVIAR SOLICITUD DE AMISTAD
app.post('/api/friends/request', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'No autenticado' });

    const { receiverNickname, receiverId, message } = req.body;
    let targetUser = null;

    if (receiverId) {
      targetUser = await prisma.user.findUnique({ where: { id: receiverId } });
    } else if (receiverNickname) {
      const cleanNick = String(receiverNickname).trim().replace('@', '');
      targetUser = await prisma.user.findUnique({ where: { nickname: cleanNick } });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario destinatario no encontrado en la base de datos.' });
    }

    if (targetUser.id === senderId) {
      return res.status(400).json({ error: 'No puedes enviarte una solicitud a ti mismo.' });
    }

    // Verificar si ya son amigos en la tabla Friendship
    const [uA, uB] = senderId < targetUser.id ? [senderId, targetUser.id] : [targetUser.id, senderId];
    const existingFriendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: uA, userBId: uB } },
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'Ya eres amigo de este usuario.' });
    }

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) return res.status(404).json({ error: 'Remitente no encontrado.' });

    // Verificar si ya existe una solicitud pendiente
    const existingReq = await prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: targetUser.id,
        },
      },
    });

    if (existingReq && existingReq.status === 'pending') {
      return res.status(400).json({ error: 'Ya tienes una solicitud de amistad pendiente con este usuario.' });
    }

    // Crear o actualizar solicitud de amistad a estado pending
    const friendRequest = await prisma.friendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: targetUser.id,
        },
      },
      create: {
        senderId,
        receiverId: targetUser.id,
        status: 'pending',
        message: message ? String(message).trim() : '¡Hola! Me gustaría conectar contigo en Evolve.',
      },
      update: {
        status: 'pending',
        message: message ? String(message).trim() : '¡Hola! Me gustaría conectar contigo en Evolve.',
      },
    });

    // Limpiar notificaciones previas de friend_request de este remitente para no duplicar jamás
    await prisma.notification.deleteMany({
      where: {
        userId: targetUser.id,
        senderId: sender.id,
        type: 'friend_request',
      },
    });

    // Crear UNA SOLA notificación limpia para el receptor
    const senderNick = sender.nickname ? `@${sender.nickname}` : `@${sender.email.split('@')[0]}`;
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        senderId: sender.id,
        type: 'friend_request',
        referenceId: friendRequest.id,
        title: 'Nueva solicitud de amistad',
        message: `${sender.name} (${senderNick}) te ha enviado una solicitud de amistad.`,
        read: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Solicitud enviada correctamente',
      request: friendRequest,
    });
  } catch (error) {
    console.error('Error en /api/friends/request:', error);
    return res.status(500).json({ error: 'Error al enviar solicitud de amistad.' });
  }
});

// 2. OBTENER SOLICITUDES PENDIENTES
app.get('/api/friends/requests', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const received = await prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            nickname: true,
            avatarUrl: true,
            streak: true,
            level: true,
            rankTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sent = await prisma.friendRequest.findMany({
      where: { senderId: userId, status: 'pending' },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            nickname: true,
            avatarUrl: true,
            level: true,
            rankTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ received, sent });
  } catch (error) {
    console.error('Error en /api/friends/requests:', error);
    return res.status(500).json({ error: 'Error al obtener solicitudes.' });
  }
});

// 3. RESPONDER SOLICITUD DE AMISTAD (ACEPTAR / RECHAZAR)
app.post('/api/friends/request/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { id } = req.params;
    const { accept } = req.body;

    let request = await prisma.friendRequest.findUnique({
      where: { id },
      include: { sender: true, receiver: true },
    });

    if (!request) {
      // 1. Buscar por notificación
      const notif = await prisma.notification.findUnique({ where: { id } });
      if (notif && notif.referenceId) {
        request = await prisma.friendRequest.findUnique({
          where: { id: notif.referenceId },
          include: { sender: true, receiver: true },
        });
      }
    }

    if (!request) {
      // 2. Buscar por senderId y receiverId
      request = await prisma.friendRequest.findFirst({
        where: { senderId: id, receiverId: userId },
        include: { sender: true, receiver: true },
      });
    }

    if (request && request.receiverId === userId) {
      if (accept) {
        await prisma.friendRequest.update({
          where: { id: request.id },
          data: { status: 'accepted' },
        });

        const [uA, uB] =
          request.senderId < request.receiverId
            ? [request.senderId, request.receiverId]
            : [request.receiverId, request.senderId];

        await prisma.friendship.upsert({
          where: { userAId_userBId: { userAId: uA, userBId: uB } },
          create: { userAId: uA, userBId: uB },
          update: {},
        });

        // Notificación de confirmación para el remitente
        const receiverNick = request.receiver.nickname ? `@${request.receiver.nickname}` : '';
        await prisma.notification.create({
          data: {
            userId: request.senderId,
            senderId: userId,
            type: 'activity',
            referenceId: request.id,
            title: '¡Solicitud aceptada! 🤝',
            message: `${request.receiver.name} (${receiverNick}) aceptó tu solicitud de amistad. ¡Ahora pueden retarse y entrenar juntos!`,
            read: false,
          },
        });
      } else {
        await prisma.friendRequest.update({
          where: { id: request.id },
          data: { status: 'rejected' },
        });

        const [uA, uB] =
          request.senderId < request.receiverId
            ? [request.senderId, request.receiverId]
            : [request.receiverId, request.senderId];
        await prisma.friendship.deleteMany({
          where: { userAId: uA, userBId: uB },
        });

        // Notificación para el remitente informando que la solicitud fue declinada
        const receiverNick = request.receiver.nickname ? `@${request.receiver.nickname}` : '';
        await prisma.notification.create({
          data: {
            userId: request.senderId,
            senderId: userId,
            type: 'activity',
            referenceId: request.id,
            title: 'Solicitud no aceptada',
            message: `${request.receiver.name} (${receiverNick}) no aceptó tu solicitud de amistad.`,
            read: false,
          },
        });
      }

      // Eliminar definitivamente todas las notificaciones de friend_request de este remitente para el receptor
      await prisma.notification.deleteMany({
        where: {
          userId,
          OR: [
            { referenceId: request.id },
            { id },
            { senderId: request.senderId, type: 'friend_request' },
          ],
        },
      });

      return res.json({
        success: true,
        status: accept ? 'accepted' : 'rejected',
      });
    }

    // Fallback: si no había registro formal de FriendRequest pero existe una notificación huérfana
    await prisma.notification.deleteMany({
      where: {
        userId,
        OR: [{ id }, { senderId: id, type: 'friend_request' }],
      },
    });

    // Fallback: si se intentó aceptar directamente pasando el ID de usuario
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser && accept) {
      const [uA, uB] = userId < targetUser.id ? [userId, targetUser.id] : [targetUser.id, userId];
      await prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: uA, userBId: uB } },
        create: { userAId: uA, userBId: uB },
        update: {},
      });
      return res.json({ success: true, status: 'accepted' });
    }

    return res.json({ success: true, status: accept ? 'accepted' : 'rejected' });
  } catch (error) {
    console.error('Error en /api/friends/request/:id/respond:', error);
    return res.status(500).json({ error: 'Error al responder solicitud.' });
  }
});

// AGREGAR AMIGO DIRECTAMENTE EN LA BASE DE DATOS
app.post('/api/friends/add', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { friendId, friendNickname } = req.body;
    let targetUser = null;

    if (friendId) {
      targetUser = await prisma.user.findUnique({ where: { id: friendId } });
    }
    if (!targetUser && friendNickname) {
      const cleanNick = String(friendNickname).trim().replace('@', '');
      targetUser = await prisma.user.findUnique({ where: { nickname: cleanNick } });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado en la base de datos.' });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ error: 'No puedes agregarte a ti mismo como amigo.' });
    }

    const [uA, uB] = userId < targetUser.id ? [userId, targetUser.id] : [targetUser.id, userId];
    await prisma.friendship.upsert({
      where: { userAId_userBId: { userAId: uA, userBId: uB } },
      create: { userAId: uA, userBId: uB },
      update: {},
    });

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    const userNick = currentUser?.nickname ? `@${currentUser.nickname}` : '';
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        senderId: userId,
        type: 'activity',
        title: '¡Nuevo amigo conectado! 🤝',
        message: `${currentUser?.name || 'Un atleta'} (${userNick}) se conectó contigo como amigo en Evolve.`,
        read: false,
      },
    });

    return res.json({ success: true, message: 'Amistad guardada exitosamente en la base de datos.' });
  } catch (err) {
    console.error('Error en /api/friends/add:', err);
    return res.status(500).json({ error: 'Error al agregar amigo en la base de datos.' });
  }
});

// 4. LISTAR AMIGOS CONFIRMADOS
app.get('/api/friends', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    let friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: {
          select: {
            id: true,
            name: true,
            nickname: true,
            avatarUrl: true,
            streak: true,
            level: true,
            rankTitle: true,
            totalXp: true,
            dataRecords: true,
          },
        },
        userB: {
          select: {
            id: true,
            name: true,
            nickname: true,
            avatarUrl: true,
            streak: true,
            level: true,
            rankTitle: true,
            totalXp: true,
            dataRecords: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Formatear la lista de amigos extrayendo el otro usuario
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friendUser = f.userAId === userId ? f.userB : f.userA;
        const cleanNick = friendUser.nickname ? `@${friendUser.nickname}` : '';

        // Procesar dataRecords reales de la base de datos
        const records: Record<string, any> = {};
        if (Array.isArray(friendUser.dataRecords)) {
          for (const r of friendUser.dataRecords) {
            try {
              records[r.dataType] = JSON.parse(r.payload);
            } catch {
              records[r.dataType] = r.payload;
            }
          }
        }

        const fullProfile = buildFriendFullProfile(friendUser, records);

        const metrics = {
          currentWeight: fullProfile.measurements.currentWeight,
          bodyFat: fullProfile.measurements.bodyFat,
          avgCalories: fullProfile.food.targetCalories,
          avgProtein: fullProfile.food.macros.protein,
          prs: fullProfile.workout.prs,
          recentWorkouts: fullProfile.workout.recentWorkouts,
          activeGoal: fullProfile.home.activeGoals[0]?.title || 'Superar sus marcas personales',
        };

        return {
          id: friendUser.id,
          name: friendUser.name,
          nickname: cleanNick,
          streak: friendUser.streak || 0,
          level: friendUser.level || 1,
          rank: friendUser.rankTitle || 'Atleta Activo',
          todayWorkout: fullProfile.workout.recentWorkouts[0]?.title || 'Entrenamiento Evolve 🔥',
          color: fullProfile.customization.palette.primary,
          initials: friendUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
          avatarUri: friendUser.avatarUrl || undefined,
          metrics,
          fullProfile,
        };
      })
    );

    return res.json({ friends });
  } catch (error) {
    console.error('Error en /api/friends:', error);
    return res.status(500).json({ error: 'Error al listar amigos.' });
  }
});

// 5. ELIMINAR AMIGO (BILATERAL Y LIMPIEZA COMPLETA)
app.delete('/api/friends/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const targetParam = req.params.id;
    const cleanNick = targetParam.replace('@', '');
    const matched = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetParam },
          { nickname: cleanNick },
          { nickname: targetParam },
        ],
      },
    });

    const targetId = matched ? matched.id : targetParam;
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });

    const [uA, uB] = userId < targetId ? [userId, targetId] : [targetId, userId];

    // 1. Eliminar la relación de amistad bidireccional en la tabla Friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userAId: uA, userBId: uB },
          { userAId: userId, userBId: targetId },
          { userAId: targetId, userBId: userId },
        ],
      },
    });

    // 2. Limpiar todas las solicitudes de amistad previas entre ambos para permitir reconexión limpia
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
    });

    // 3. Limpiar respaldo de UserData en AMBOS usuarios (para que ninguno tenga al otro en caché)
    const cleanUserNick = currentUser?.nickname?.replace('@', '').toLowerCase();
    const cleanTargetNick = (matched?.nickname || cleanNick).replace('@', '').toLowerCase();

    const purgeUserDataFriends = async (ownerId: string, removeId: string, removeNick?: string) => {
      try {
        const record = await prisma.userData.findUnique({
          where: { userId_dataType: { userId: ownerId, dataType: 'friends' } },
        });
        if (record?.payload) {
          const parsed = JSON.parse(record.payload);
          if (Array.isArray(parsed)) {
            const cleanR = removeNick?.toLowerCase();
            const updated = parsed.filter((f: any) => {
              const fNick = (f.nickname || '').replace('@', '').toLowerCase();
              return f.id !== removeId && (!cleanR || fNick !== cleanR);
            });
            await prisma.userData.update({
              where: { userId_dataType: { userId: ownerId, dataType: 'friends' } },
              data: { payload: JSON.stringify(updated) },
            });
          }
        }
      } catch {}
    };

    await purgeUserDataFriends(userId, targetId, cleanTargetNick);
    await purgeUserDataFriends(targetId, userId, cleanUserNick);

    return res.json({ success: true, message: 'Amigo eliminado bilateralmente de la base de datos.' });
  } catch (error) {
    console.error('Error en /api/friends/:id:', error);
    return res.status(500).json({ error: 'Error al eliminar amigo.' });
  }
});

// 6. ENVIAR INVITACIÓN A ENTRENAR
app.post('/api/workouts/invite', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'No autenticado' });

    const { receiverId, workoutType, muscleDivision, targetDate, targetTime, location, note } = req.body;
    if (!receiverId || !workoutType || !targetDate || !targetTime) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para la invitación.' });
    }

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) return res.status(404).json({ error: 'Remitente no encontrado.' });

    // Resolver atleta destinatario por id o nickname (@nickname)
    let targetUser = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!targetUser) {
      const cleanNick = String(receiverId).trim().replace('@', '');
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: receiverId }, { nickname: cleanNick }, { nickname: `@${cleanNick}` }],
        },
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Atleta destinatario no encontrado.' });
    }
    const targetUserId = targetUser.id;

    const invitation = await prisma.workoutInvitation.create({
      data: {
        senderId,
        receiverId: targetUserId,
        workoutType,
        muscleDivision: muscleDivision || null,
        targetDate,
        targetTime,
        location: location || null,
        note: note || null,
        status: 'pending',
      },
    });

    const senderNick = sender.nickname ? `@${sender.nickname}` : '';
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        senderId,
        type: 'workout_invite',
        referenceId: invitation.id,
        title: 'Invitación a entrenar 🏋️‍♂️',
        message: `${sender.name} (${senderNick}) te invitó a entrenar ${workoutType}${muscleDivision ? ' (' + muscleDivision + ')' : ''} el ${targetDate} a las ${targetTime}.`,
        read: false,
      },
    });

    return res.status(201).json({ success: true, invitation });
  } catch (error) {
    console.error('Error en /api/workouts/invite:', error);
    return res.status(500).json({ error: 'Error al enviar invitación de entrenamiento.' });
  }
});

// 7. OBTENER INVITACIONES DE ENTRENAMIENTO
app.get('/api/workouts/invites', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const invites = await prisma.workoutInvitation.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ invites });
  } catch (error) {
    console.error('Error en /api/workouts/invites:', error);
    return res.status(500).json({ error: 'Error al listar invitaciones.' });
  }
});

// 8. RESPONDER INVITACIÓN DE ENTRENAMIENTO
app.post('/api/workouts/invite/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { id } = req.params;
    const { accept } = req.body;

    let invite = await prisma.workoutInvitation.findUnique({
      where: { id },
      include: { sender: true, receiver: true },
    });

    if (!invite) {
      // Buscar si el id corresponde a la notificación
      const notif = await prisma.notification.findUnique({ where: { id } });
      if (notif && notif.referenceId) {
        invite = await prisma.workoutInvitation.findUnique({
          where: { id: notif.referenceId },
          include: { sender: true, receiver: true },
        });
      }
    }

    if (!invite || invite.receiverId !== userId) {
      return res.status(404).json({ error: 'Invitación no encontrada.' });
    }

    const updated = await prisma.workoutInvitation.update({
      where: { id: invite.id },
      data: { status: accept ? 'accepted' : 'rejected' },
    });

    await prisma.notification.create({
      data: {
        userId: invite.senderId,
        senderId: userId,
        type: 'activity',
        referenceId: invite.id,
        title: accept ? '¡Entrenamiento Confirmado! 🎯' : 'Invitación declinada',
        message: `${invite.receiver.name} ${accept ? 'aceptó entrenar juntos el ' + invite.targetDate : 'no podrá asistir a la sesión'}.`,
        read: false,
      },
    });

    await prisma.notification.updateMany({
      where: {
        userId,
        OR: [{ referenceId: invite.id }, { id }],
      },
      data: { read: true },
    });

    return res.json({ success: true, invitation: updated });
  } catch (error) {
    console.error('Error en /api/workouts/invite/:id/respond:', error);
    return res.status(500).json({ error: 'Error al responder invitación.' });
  }
});

// 9. ENVIAR RETO (DUELO 1 VS 1)
app.post('/api/challenges', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'No autenticado' });

    const { receiverId, targetDate, variableType, variableLabel, muscleOrExercise, message } = req.body;
    if (!receiverId || !targetDate || !variableType || !variableLabel) {
      return res.status(400).json({ error: 'Faltan parámetros del reto.' });
    }

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) return res.status(404).json({ error: 'Remitente no encontrado.' });

    // Resolver atleta destinatario por id o nickname (@nickname)
    let targetUser = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!targetUser) {
      const cleanNick = String(receiverId).trim().replace('@', '');
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: receiverId }, { nickname: cleanNick }, { nickname: `@${cleanNick}` }],
        },
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Atleta destinatario no encontrado.' });
    }
    const targetUserId = targetUser.id;

    const challenge = await prisma.challenge.create({
      data: {
        senderId,
        receiverId: targetUserId,
        targetDate,
        variableType,
        variableLabel,
        muscleOrExercise: muscleOrExercise || null,
        message: message || null,
        status: 'pending',
      },
    });

    const senderNick = sender.nickname ? `@${sender.nickname}` : '';
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        senderId,
        type: 'challenge',
        referenceId: challenge.id,
        title: '⚔️ ¡Nuevo Reto 1 vs 1!',
        message: `${sender.name} (${senderNick}) te ha retado en ${variableLabel}${muscleOrExercise ? ' [' + muscleOrExercise + ']' : ''} para el ${targetDate}. (+50 XP al ganador / -25 XP al perdedor).`,
        read: false,
      },
    });

    return res.status(201).json({ success: true, challenge });
  } catch (error) {
    console.error('Error en /api/challenges:', error);
    return res.status(500).json({ error: 'Error al crear reto.' });
  }
});

// 10. OBTENER RETOS
app.get('/api/challenges', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ challenges });
  } catch (error) {
    console.error('Error en /api/challenges:', error);
    return res.status(500).json({ error: 'Error al listar retos.' });
  }
});

// 11. RESPONDER A RETO
app.post('/api/challenges/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { id } = req.params;
    const { accept } = req.body;

    let challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { sender: true, receiver: true },
    });

    if (!challenge) {
      // Buscar si el id corresponde a la notificación
      const notif = await prisma.notification.findUnique({ where: { id } });
      if (notif && notif.referenceId) {
        challenge = await prisma.challenge.findUnique({
          where: { id: notif.referenceId },
          include: { sender: true, receiver: true },
        });
      }
    }

    if (!challenge || challenge.receiverId !== userId) {
      return res.status(404).json({ error: 'Reto no encontrado.' });
    }

    const updated = await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: accept ? 'accepted' : 'rejected' },
    });

    await prisma.notification.create({
      data: {
        userId: challenge.senderId,
        senderId: userId,
        type: 'activity',
        referenceId: challenge.id,
        title: accept ? '⚔️ ¡Reto Aceptado!' : 'Reto Declinado',
        message: `${challenge.receiver.name} ${accept ? 'aceptó el duelo para el ' + challenge.targetDate + '. ¡A darlo todo!' : 'declinó tu reto'}.`,
        read: false,
      },
    });

    await prisma.notification.updateMany({
      where: {
        userId,
        OR: [{ referenceId: challenge.id }, { id }],
      },
      data: { read: true },
    });

    return res.json({ success: true, challenge: updated });
  } catch (error) {
    console.error('Error en /api/challenges/:id/respond:', error);
    return res.status(500).json({ error: 'Error al responder reto.' });
  }
});

// 12. OBTENER NOTIFICACIONES DEL USUARIO
app.get('/api/notifications', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const rawNotifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    // Deduplicar solicitudes y auto-limpiar notificaciones obsoletas de la BD
    const seenFriendRequestSenders = new Set<string>();
    const validNotifications: any[] = [];

    for (const n of rawNotifications) {
      if (n.type === 'friend_request') {
        // Si ya hay una notificación más reciente de este remitente, borrar el duplicado de la BD
        if (seenFriendRequestSenders.has(n.senderId)) {
          await prisma.notification.delete({ where: { id: n.id } }).catch(() => {});
          continue;
        }

        // Buscar estado de la solicitud en FriendRequest
        let fr = null;
        if (n.referenceId) {
          fr = await prisma.friendRequest.findUnique({ where: { id: n.referenceId } });
        }
        if (!fr) {
          fr = await prisma.friendRequest.findFirst({
            where: { senderId: n.senderId, receiverId: userId },
          });
        }

        // Si ya no existe o no está pendiente (fue rechazada o aceptada previamente)
        if (!fr || fr.status !== 'pending') {
          await prisma.notification.delete({ where: { id: n.id } }).catch(() => {});
          continue;
        }

        seenFriendRequestSenders.add(n.senderId);
        validNotifications.push({ ...n, calculatedStatus: fr.status });
      } else if (n.type === 'workout_invite') {
        let inv = null;
        if (n.referenceId) {
          inv = await prisma.workoutInvitation.findUnique({ where: { id: n.referenceId } });
        }
        validNotifications.push({ ...n, calculatedStatus: inv ? inv.status : 'pending' });
      } else if (n.type === 'challenge') {
        let ch = null;
        if (n.referenceId) {
          ch = await prisma.challenge.findUnique({ where: { id: n.referenceId } });
        }
        validNotifications.push({ ...n, calculatedStatus: ch ? ch.status : 'pending' });
      } else {
        validNotifications.push({ ...n, calculatedStatus: 'pending' });
      }
    }

    // Enriquecer datos con info de sender
    const enriched = await Promise.all(
      validNotifications.map(async (n) => {
        const sender = await prisma.user.findUnique({
          where: { id: n.senderId },
          select: {
            id: true,
            name: true,
            nickname: true,
            avatarUrl: true,
            level: true,
            rankTitle: true,
          },
        });

        // Buscar detalles si aplica
        let workoutDetails = undefined;
        let challengeDetails = undefined;

        if (n.type === 'workout_invite' && n.referenceId) {
          const inv = await prisma.workoutInvitation.findUnique({ where: { id: n.referenceId } });
          if (inv) {
            workoutDetails = {
              workoutType: inv.workoutType,
              dateTime: `${inv.targetDate} ${inv.targetTime}`,
              location: inv.location || undefined,
              note: inv.note || undefined,
            };
          }
        } else if (n.type === 'challenge' && n.referenceId) {
          const ch = await prisma.challenge.findUnique({ where: { id: n.referenceId } });
          if (ch) {
            challengeDetails = {
              targetDate: ch.targetDate,
              variableType: ch.variableType,
              variableLabel: ch.variableLabel,
              muscleOrExercise: ch.muscleOrExercise || undefined,
              message: ch.message || undefined,
            };
          }
        }

        const senderNick = sender?.nickname ? `@${sender.nickname}` : '@usuario';
        const senderName = sender?.name || 'Compañero Evolve';

        return {
          id: n.id,
          type: n.type,
          title: n.title,
          senderId: n.senderId,
          senderName,
          senderNickname: senderNick,
          senderAvatarUri: sender?.avatarUrl || undefined,
          senderColor: '#8B5CF6',
          senderInitials: senderName.split(' ').map((p) => p[0]).join('').substring(0, 2).toUpperCase(),
          senderLevel: sender?.level || 1,
          senderRank: sender?.rankTitle || 'Atleta',
          date: new Date(n.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          read: n.read,
          status: n.calculatedStatus || 'pending',
          message: n.message,
          workoutDetails,
          challengeDetails,
        };
      })
    );

    return res.json({ notifications: enriched });
  } catch (error) {
    console.error('Error en /api/notifications:', error);
    return res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
});

// 13. MARCAR NOTIFICACIONES COMO LEÍDAS
app.put('/api/notifications/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { notificationIds } = req.body;
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: { userId, id: { in: notificationIds } },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    }

    return res.json({ success: true, message: 'Notificaciones actualizadas.' });
  } catch (error) {
    console.error('Error en /api/notifications/read:', error);
    return res.status(500).json({ error: 'Error al marcar notificaciones.' });
  }
});

/* ==========================================================
   RUTAS DE SINCRONIZACIÓN DE DATOS (NUBE / BASE DE DATOS)
========================================================== */

// PUSH: Guarda o actualiza los datos del usuario en la base de datos
app.post('/api/sync/push', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { records } = req.body; // { workouts: {...}, meals: {...}, ... }
    if (!records || typeof records !== 'object') {
      return res.status(400).json({ error: 'Formato de datos inválido.' });
    }

    const updates = Object.entries(records).map(([dataType, payload]) => {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      return prisma.userData.upsert({
        where: {
          userId_dataType: { userId, dataType },
        },
        create: {
          userId,
          dataType,
          payload: payloadStr,
        },
        update: {
          payload: payloadStr,
        },
      });
    });

    await prisma.$transaction(updates);

    return res.json({ success: true, count: updates.length, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error en /api/sync/push:', error);
    return res.status(500).json({ error: 'Error al sincronizar datos en el servidor.' });
  }
});

// PULL: Obtiene todos los datos guardados del usuario en la base de datos
app.get('/api/sync/pull', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const records = await prisma.userData.findMany({ where: { userId } });
    const formatted: Record<string, any> = {};

    for (const r of records) {
      try {
        formatted[r.dataType] = JSON.parse(r.payload);
      } catch {
        formatted[r.dataType] = r.payload;
      }
    }

    return res.json({ records: formatted });
  } catch (error) {
    console.error('Error en /api/sync/pull:', error);
    return res.status(500).json({ error: 'Error al recuperar datos del servidor.' });
  }
});

/* ==========================================================
   INICIALIZACIÓN DEL SERVIDOR
========================================================== */
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`===============================================`);
  console.log(`🚀 Servidor Evolve activo en puerto ${PORT}`);
  console.log(`📡 URL Local:   http://localhost:${PORT}`);
  console.log(`📡 Red Móvil:   http://0.0.0.0:${PORT}`);
  console.log(`===============================================`);

  // Seed de comunidad desactivado (solo usuarios registrados en base de datos)
  // await seedCommunityAthletes();
});
