import MercadoPago from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

MercadoPago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN, // Adicione no .env
});

export default MercadoPago;
