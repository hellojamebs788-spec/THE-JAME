# 💰 Money Tracker + Supabase

เว็บรายรับรายจ่าย พร้อมเชื่อม Supabase และ OCR อ่านสลิป

---

## 📦 ไฟล์ในโปรเจกต์

- index.html
- style.css
- script.js
- readme.md

---

## 🚀 วิธีใช้งาน

### 1. สร้าง Table ใน Supabase

ใช้ SQL นี้:

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),

  title text,
  amount numeric,
  type text,
  category text,
  note text,

  created_at timestamp with time zone default now()
);
```

---

### 2. Upload ขึ้น GitHub

สร้าง Repository ใหม่

เช่น:

money-tracker

อัปโหลดทุกไฟล์ขึ้น GitHub

---

### 3. เปิด GitHub Pages

ไปที่:

Settings → Pages

เลือก:

Deploy from branch

เลือก:

main

/root

Save

---

## ✅ ฟีเจอร์

- เพิ่มรายรับ
- เพิ่มรายจ่าย
- เพิ่มหนี้สิน
- สรุปยอด
- อ่านสลิป OCR
- เก็บข้อมูลใน Supabase
- ใช้งานบนมือถือได้

---

## 🔥 Supabase Config

Project URL:
https://afkjxrzuvuxxjtjypzcq.supabase.co

เชื่อมเรียบร้อยใน script.js แล้ว
