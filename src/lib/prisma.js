// src/lib/prisma.js
console.log('🔥 acessando banco real'); // ← se aparecer no teste, tem algo errado

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = prisma;
