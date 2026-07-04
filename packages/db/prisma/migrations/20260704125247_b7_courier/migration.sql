-- CreateEnum
CREATE TYPE "CourierProviderName" AS ENUM ('STEADFAST', 'PATHAO', 'REDX', 'ECOURIER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "provider" "CourierProviderName" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "consignment_id" TEXT,
    "tracking_code" TEXT,
    "cost" DECIMAL(10,2),
    "weight" DECIMAL(10,3),
    "cod_amount" DECIMAL(10,2),
    "return_reason" TEXT,
    "error_message" TEXT,
    "request_payload" JSONB,
    "raw_response" JSONB,
    "dispatched_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "note" TEXT,
    "raw_payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
