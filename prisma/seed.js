const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.store.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Frutería Steve', mercadoPagoAccessToken: null },
  });

  const users = [
    { name: 'Admin Steve', email: 'admin@fruteriasteve.com', phone: '5512345678', password: '123456', role: 'admin' },
    { name: 'Cajero Ana', email: 'cajero@fruteriasteve.com', phone: '5512345679', password: '123456', role: 'cajero' },
    { name: 'Cliente Juan', email: 'cliente@fruteriasteve.com', phone: '5512345680', password: '123456', role: 'cliente' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: u,
      create: u,
    });
  }

  const products = [
    { name: 'Manzana Roja', category: 'Frutas', price: 32, stock: 18, unit: 'kg', description: 'Manzana fresca de temporada.', image: '🍎', active: true },
    { name: 'Plátano', category: 'Frutas', price: 22, stock: 25, unit: 'kg', description: 'Excelente para smoothies y postres.', image: '🍌', active: true },
    { name: 'Naranja', category: 'Frutas', price: 26, stock: 15, unit: 'kg', description: 'Jugosa y rica en vitamina C.', image: '🍊', active: true },
    { name: 'Jitomate', category: 'Verduras', price: 18, stock: 12, unit: 'kg', description: 'Ideal para salsas y ensaladas.', image: '🍅', active: true },
    { name: 'Lechuga', category: 'Verduras', price: 15, stock: 7, unit: 'pieza', description: 'Fresca y limpia.', image: '🥬', active: true },
    { name: 'Zanahoria', category: 'Verduras', price: 20, stock: 10, unit: 'kg', description: 'Crunchy y muy rica.', image: '🥕', active: true },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { name: p.name },
      update: p,
      create: p,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
