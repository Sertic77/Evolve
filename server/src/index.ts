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
    const { email, password, name, nickname } = req.body;

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

    const cleanNick = nickname
      ? String(nickname).trim().replace('@', '').toLowerCase()
      : cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');

    // Verificar si el nickname ya existe
    const existingNick = await prisma.user.findUnique({ where: { nickname: cleanNick } });
    const finalNick = existingNick ? `${cleanNick}_${Math.floor(100 + Math.random() * 900)}` : cleanNick;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        name: String(name).trim(),
        nickname: finalNick,
        provider: 'email',
        streak: 0,
        level: 1,
        rankTitle: 'Iniciado Fitness',
        totalXp: 0,
      },
    });

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
    });
  } catch (error) {
    console.error('Error en /api/auth/register:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar usuario.' });
  }
});

// 2. INICIO DE SESIÓN CON CORREO Y CONTRASEÑA
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Ingresa correo y contraseña.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
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
      const baseNick = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      const existingNick = await prisma.user.findUnique({ where: { nickname: baseNick } });
      const finalNick = existingNick ? `${baseNick}_${Math.floor(100 + Math.random() * 900)}` : baseNick;

      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name ? String(name).trim() : cleanEmail.split('@')[0],
          nickname: finalNick,
          provider: provider === 'apple' ? 'apple' : 'google',
          providerId: providerId ? String(providerId) : undefined,
          avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
          streak: 0,
          level: 1,
          rankTitle: 'Iniciado Fitness',
          totalXp: 0,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          providerId: providerId ? String(providerId) : user.providerId,
          avatarUrl: avatarUrl ? String(avatarUrl) : user.avatarUrl,
        },
      });
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
    console.error('Error en /api/auth/social:', error);
    return res.status(500).json({ error: 'Error interno al autenticar con proveedor social.' });
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

    // Crear o actualizar solicitud de amistad
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

    // Crear notificación para el receptor
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
      }

      // Marcar la notificación correspondiente como leída
      await prisma.notification.updateMany({
        where: {
          userId,
          OR: [{ referenceId: request.id }, { id }],
        },
        data: { read: true },
      });

      return res.json({
        success: true,
        status: accept ? 'accepted' : 'rejected',
      });
    }

    // Fallback: si no había registro formal de FriendRequest pero existe el usuario remitente
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

    return res.status(404).json({ error: 'Solicitud no encontrada o no te pertenece.' });
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Si aún no hay filas en Friendship, verificar si hay respaldo en UserData y auto-sincronizar
    if (friendships.length === 0) {
      const savedFriendsData = await prisma.userData.findUnique({
        where: { userId_dataType: { userId, dataType: 'friends' } },
      });
      if (savedFriendsData && savedFriendsData.payload) {
        try {
          const parsed = JSON.parse(savedFriendsData.payload);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const f of parsed) {
              const matched = await prisma.user.findFirst({
                where: {
                  OR: [
                    { id: f.id },
                    { nickname: f.nickname ? f.nickname.replace('@', '') : undefined },
                  ],
                },
              });
              if (matched && matched.id !== userId) {
                const [uA, uB] = userId < matched.id ? [userId, matched.id] : [matched.id, userId];
                await prisma.friendship.upsert({
                  where: { userAId_userBId: { userAId: uA, userBId: uB } },
                  create: { userAId: uA, userBId: uB },
                  update: {},
                });
              }
            }
            friendships = await prisma.friendship.findMany({
              where: { OR: [{ userAId: userId }, { userBId: userId }] },
              include: { userA: true, userB: true },
              orderBy: { createdAt: 'desc' },
            });
          }
        } catch {
          // continuar
        }
      }
    }

    // Formatear la lista de amigos extrayendo el otro usuario
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friendUser = f.userAId === userId ? f.userB : f.userA;
        const cleanNick = friendUser.nickname ? `@${friendUser.nickname}` : '';

        // Buscar métricas guardadas si existen
        let metrics: any = {
          currentWeight: 75,
          bodyFat: 15,
          avgCalories: 2500,
          avgProtein: 160,
          prs: [],
          recentWorkouts: [],
          activeGoal: 'Superar sus marcas personales',
        };

        const metricsData = await prisma.userData.findUnique({
          where: { userId_dataType: { userId: friendUser.id, dataType: 'metrics' } },
        });

        if (metricsData) {
          try {
            metrics = JSON.parse(metricsData.payload);
          } catch {
            // usar fallback
          }
        }

        return {
          id: friendUser.id,
          name: friendUser.name,
          nickname: cleanNick,
          streak: friendUser.streak || 0,
          level: friendUser.level || 1,
          rank: friendUser.rankTitle || 'Atleta Activo',
          todayWorkout: 'Entrenamiento Evolve 🔥',
          color: '#8B5CF6',
          initials: friendUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
          avatarUri: friendUser.avatarUrl || undefined,
          metrics,
        };
      })
    );

    return res.json({ friends });
  } catch (error) {
    console.error('Error en /api/friends:', error);
    return res.status(500).json({ error: 'Error al listar amigos.' });
  }
});

// 5. ELIMINAR AMIGO
app.delete('/api/friends/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const friendId = req.params.id;
    const [uA, uB] = userId < friendId ? [userId, friendId] : [friendId, userId];

    await prisma.friendship.deleteMany({
      where: { userAId: uA, userBId: uB },
    });

    return res.json({ success: true, message: 'Amigo eliminado correctamente.' });
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

    const invitation = await prisma.workoutInvitation.create({
      data: {
        senderId,
        receiverId,
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
        userId: receiverId,
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

    const invite = await prisma.workoutInvitation.findUnique({
      where: { id },
      include: { sender: true, receiver: true },
    });

    if (!invite || invite.receiverId !== userId) {
      return res.status(404).json({ error: 'Invitación no encontrada.' });
    }

    const updated = await prisma.workoutInvitation.update({
      where: { id },
      data: { status: accept ? 'accepted' : 'rejected' },
    });

    await prisma.notification.create({
      data: {
        userId: invite.senderId,
        senderId: userId,
        type: 'activity',
        referenceId: id,
        title: accept ? '¡Entrenamiento Confirmado! 🎯' : 'Invitación declinada',
        message: `${invite.receiver.name} ${accept ? 'aceptó entrenar juntos el ' + invite.targetDate : 'no podrá asistir a la sesión'}.`,
        read: false,
      },
    });

    await prisma.notification.updateMany({
      where: { userId, referenceId: id },
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

    const challenge = await prisma.challenge.create({
      data: {
        senderId,
        receiverId,
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
        userId: receiverId,
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

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { sender: true, receiver: true },
    });

    if (!challenge || challenge.receiverId !== userId) {
      return res.status(404).json({ error: 'Reto no encontrado.' });
    }

    const updated = await prisma.challenge.update({
      where: { id },
      data: { status: accept ? 'accepted' : 'rejected' },
    });

    await prisma.notification.create({
      data: {
        userId: challenge.senderId,
        senderId: userId,
        type: 'activity',
        referenceId: id,
        title: accept ? '⚔️ ¡Reto Aceptado!' : 'Reto Declinado',
        message: `${challenge.receiver.name} ${accept ? 'aceptó el duelo para el ' + challenge.targetDate + '. ¡A darlo todo!' : 'declinó tu reto'}.`,
        read: false,
      },
    });

    await prisma.notification.updateMany({
      where: { userId, referenceId: id },
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

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    // Enriquecer datos con info de sender
    const enriched = await Promise.all(
      notifications.map(async (n) => {
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
          status: 'pending',
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

    // Auto-sincronizar relaciones Friendship si se enviaron amigos
    if (records.friends && Array.isArray(records.friends)) {
      for (const f of records.friends) {
        if (f.id && f.id !== userId) {
          const cleanNick = f.nickname ? String(f.nickname).replace('@', '') : undefined;
          const matched = await prisma.user.findFirst({
            where: {
              OR: [
                { id: f.id },
                { nickname: cleanNick },
              ],
            },
          });
          if (matched && matched.id !== userId) {
            const [uA, uB] = userId < matched.id ? [userId, matched.id] : [matched.id, userId];
            await prisma.friendship.upsert({
              where: { userAId_userBId: { userAId: uA, userBId: uB } },
              create: { userAId: uA, userBId: uB },
              update: {},
            });
          }
        }
      }
    }

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

  // Ejecutar seed de atletas de la comunidad
  await seedCommunityAthletes();
});
