-- CreateTable
CREATE TABLE "vendor_fulfillments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "vendor_id" UUID NOT NULL,
    "subtotal_in_pesewas" INTEGER NOT NULL,
    "delivery_status" TEXT NOT NULL,
    "disbursement_status" TEXT NOT NULL,
    "disbursement_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "vendor_fulfillment_id" TEXT NOT NULL,
    "moolre_transaction_id" TEXT,
    "amount_in_pesewas" INTEGER NOT NULL,
    "moolre_fee_in_pesewas" INTEGER,
    "status" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "admin_id" TEXT,
    "poll_count" INTEGER NOT NULL DEFAULT 0,
    "next_poll_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_external_ref_key" ON "disbursements"("external_ref");

-- AddForeignKey
ALTER TABLE "vendor_fulfillments" ADD CONSTRAINT "vendor_fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (vendors table is managed via Supabase, reference directly)
ALTER TABLE "vendor_fulfillments" ADD CONSTRAINT "vendor_fulfillments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_vendor_fulfillment_id_fkey" FOREIGN KEY ("vendor_fulfillment_id") REFERENCES "vendor_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
