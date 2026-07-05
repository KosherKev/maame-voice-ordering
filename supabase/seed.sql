-- Truncate existing data to make seed reproducible
TRUNCATE public.products, public.vendors CASCADE;

-- Insert Vendors
INSERT INTO public.vendors (id, name, phone, "momoChannel", active) VALUES
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Auntie Mary''s Waakye', '0241112222', 'mtn', true),
('b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Papa''s Kenkey & Fish', '0203334444', 'telecel', true),
('c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Hajia''s Fufu Joint', '0275556666', 'at', true),
('d4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Mama Efua''s Red Red', '0547778888', 'mtn', true);

-- Insert Products
INSERT INTO public.products (id, name, "priceInPesewas", "vendorId", category, "inStock") VALUES
-- Auntie Mary's Waakye Products
(gen_random_uuid(), 'Waakye (Single Portion)', 1500, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Waakye', true),
(gen_random_uuid(), 'Waakye (Double Portion)', 3000, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Waakye', true),
(gen_random_uuid(), 'Fried Egg', 300, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Add-on', true),
(gen_random_uuid(), 'Wele (Cow Hide)', 400, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Add-on', true),
(gen_random_uuid(), 'Fried Fish', 800, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Add-on', true),
(gen_random_uuid(), 'Beef', 1000, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Add-on', true),
(gen_random_uuid(), 'Gari Portion', 200, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Add-on', true),
(gen_random_uuid(), 'Spaghetti Portion', 200, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Add-on', true),

-- Papa's Kenkey & Fish Products
(gen_random_uuid(), 'Ga Kenkey (Single)', 500, 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Kenkey', true),
(gen_random_uuid(), 'Fried Fish (Medium)', 800, 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Add-on', true),
(gen_random_uuid(), 'Fried Fish (Large)', 1500, 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Add-on', true),
(gen_random_uuid(), 'Pepper & Tomato Salsa', 200, 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Add-on', true),
(gen_random_uuid(), 'Fried Egg', 300, 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Add-on', true),
(gen_random_uuid(), 'Fried Octopus', 1200, 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Add-on', true),

-- Hajia's Fufu Joint Products
(gen_random_uuid(), 'Fufu with Light Soup (Chicken)', 2500, 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Fufu', true),
(gen_random_uuid(), 'Fufu with Light Soup (Goat Meat)', 3500, 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Fufu', true),
(gen_random_uuid(), 'Fufu with Groundnut Soup (Beef)', 3000, 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Fufu', true),
(gen_random_uuid(), 'Fufu with Palm Nut Soup (Fish)', 2800, 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Fufu', true),
(gen_random_uuid(), 'Extra Chicken/Meat', 1000, 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Add-on', true),
(gen_random_uuid(), 'Extra Soup Portion', 500, 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Add-on', true),

-- Mama Efua's Red Red Products
(gen_random_uuid(), 'Red Red Beans with Plantain (Single)', 1500, 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Red Red', true),
(gen_random_uuid(), 'Red Red Beans with Plantain (Double)', 2800, 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Red Red', true),
(gen_random_uuid(), 'Avocado Slice', 300, 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Add-on', true),
(gen_random_uuid(), 'Fried Egg', 300, 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Add-on', true),
(gen_random_uuid(), 'Coca-Cola (Can)', 800, 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Beverage', true),
(gen_random_uuid(), 'Bottled Water', 500, 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Beverage', true);
