-- Two WhatsApp origins: the existing one is "WhatsApp Official".
ALTER TYPE "OrderChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP_PERSONAL' AFTER 'WHATSAPP';
