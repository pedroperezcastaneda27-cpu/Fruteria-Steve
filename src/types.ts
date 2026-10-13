const STORAGE_KEYS = {
  users: 'fruteria-steve-users',
  products: 'fruteria-steve-products',
  cart: 'fruteria-steve-cart',
  orders: 'fruteria-steve-orders',
  sales: 'fruteria-steve-sales',
  permissions: 'fruteria-steve-permissions',
  currentUser: 'fruteria-steve-current-user',
};

export type Role = 'admin' | 'cajero' | 'cliente';

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
};

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  description: string;
  image: string;
  active: boolean;
};

export type CartItem = {
  productId: number;
  quantity: number;
};

export type Order = {
  id: string;
  userId: number;
  status: 'recibido' | 'en preparación' | 'listo para recoger' | 'entregado' | 'cancelado';
  total: number;
  createdAt: string;
  paymentStatus: 'aprobado' | 'pendiente' | 'rechazado';
  items: { productId: number; quantity: number; price: number }[];
};

export type Sale = {
  id: string;
  cashierId: number;
  total: number;
  paymentMethod: 'efectivo' | 'tarjeta' | 'digital';
  createdAt: string;
  items: { productId: number; quantity: number; price: number }[];
};

export type PermissionState = {
  catalogo: boolean;
  carrito: boolean;
  pedidos: boolean;
  caja: boolean;
  inventario: boolean;
  admin: boolean;
};

export const initialUsers: User[] = [
  {
    id: 1,
    name: 'Admin Steve',
    email: 'admin@fruteriasteve.com',
    phone: '5512345678',
    password: '123456',
    role: 'admin',
  },
  {
    id: 2,
    name: 'Cajero Ana',
    email: 'cajero@fruteriasteve.com',
    phone: '5512345679',
    password: '123456',
    role: 'cajero',
  },
  {
    id: 3,
    name: 'Cliente Juan',
    email: 'cliente@fruteriasteve.com',
    phone: '5512345680',
    password: '123456',
    role: 'cliente',
  },
];

export const initialProducts: Product[] = [
  {
    id: 1,
    name: 'Manzana Roja',
    category: 'Frutas',
    price: 32,
    stock: 18,
    unit: 'kg',
    description: 'Manzana fresca de temporada.',
    image: '🍎',
    active: true,
  },
  {
    id: 2,
    name: 'Plátano',
    category: 'Frutas',
    price: 22,
    stock: 25,
    unit: 'kg',
    description: 'Excelente para smoothies y postres.',
    image: '🍌',
    active: true,
  },
  {
    id: 3,
    name: 'Naranja',
    category: 'Frutas',
    price: 26,
    stock: 15,
    unit: 'kg',
    description: 'Jugosa y rica en vitamina C.',
    image: '🍊',
    active: true,
  },
  {
    id: 4,
    name: 'Jitomate',
    category: 'Verduras',
    price: 18,
    stock: 12,
    unit: 'kg',
    description: 'Ideal para salsas y ensaladas.',
    image: '🍅',
    active: true,
  },
  {
    id: 5,
    name: 'Lechuga',
    category: 'Verduras',
    price: 15,
    stock: 7,
    unit: 'pieza',
    description: 'Fresca y limpia.',
    image: '🥬',
    active: true,
  },
  {
    id: 6,
    name: 'Zanahoria',
    category: 'Verduras',
    price: 20,
    stock: 10,
    unit: 'kg',
    description: 'Crunchy y muy rica.',
    image: '🥕',
    active: true,
  },
];

export const initialPermissions: PermissionState = {
  catalogo: true,
  carrito: true,
  pedidos: true,
  caja: true,
  inventario: true,
  admin: true,
};

export const loadFromStorage = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const saveToStorage = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export { STORAGE_KEYS };
