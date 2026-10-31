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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        name: String(name).trim(),
        nickname: nickname ? String(nickname).trim().replace('@', '') : undefined,
        provider: 'email',
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
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name ? String(name).trim() : cleanEmail.split('@')[0],
          nickname: cleanEmail.split('@')[0],
          provider: provider === 'apple' ? 'apple' : 'google',
          providerId: providerId ? String(providerId) : undefined,
          avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
        },
      });
    } else {
      // Actualizar información si es necesario
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

    const { name, nickname, avatarUrl } = req.body;
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (nickname !== undefined) updateData.nickname = String(nickname).trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = String(avatarUrl).trim();

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
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error en /api/auth/profile:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil en la base de datos.' });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Servidor Evolve activo en puerto ${PORT}`);
  console.log(`📡 URL Local:   http://localhost:${PORT}`);
  console.log(`📡 Red Móvil:   http://0.0.0.0:${PORT}`);
  console.log(`===============================================`);
});
