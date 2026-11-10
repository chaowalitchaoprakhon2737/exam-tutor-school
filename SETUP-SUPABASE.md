1. สร้าง Supabase project
2. SQL Editor: วาง supabase.sql แล้ว Run
3. Authentication > Users > Add user สร้างอีเมล/รหัสผ่านครู
4. SQL Editor รัน: insert into public.teachers(user_id) select id from auth.users where email='อีเมลครู' on conflict do nothing;
5. Project Settings > API: คัดลอก Project URL และ Publishable/anon key ใส่ config.js (ห้ามใช้ service_role)
6. git add . && git commit -m "Add Supabase backend" && git push origin main
