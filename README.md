# แบบตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน (Pre-Use Equipment Inspection Report Generator)
ระบบสร้างรายงานและส่งออกเอกสารตรวจสอบความปลอดภัยประจำวัน สำหรับ **Full Body Harness** และ **Lanyard** ตามแบบฟอร์มมาตรฐาน กฟผ.

---

## 🚀 คุณสมบัติเด่น (Features)
- **นำเข้าข้อมูลจาก Excel (.xlsx)**: รองรับทั้งไฟล์แบบตารางรวม 2-in-1 และชีทแยกอุปกรณ์ ดึงรายชื่อผู้ตรวจและผลการตรวจสอบอัตโนมัติ
- **ระบบจับคู่รายชื่อผู้ตรวจอัจฉริยะ**: ตัดคำนำหน้าชื่อ (นาย, นางสาว, ยศ ฯลฯ) จับคู่ชื่อภาษาไทยได้อย่างแม่นยำ ไม่สับสนระหว่างชื่อที่คล้ายกัน
- **ระบบจัดการลายเซ็นดิจิทัล .PNG โปร่งใส**:
  - สร้างลายเซ็นตัวเขียนภาษาไทยจากชื่อจริงแบบดิจิทัล
  - วาดลายเซ็นสดบนหน้าจอ หรืออัปโหลดรูปลายเซ็น (JPG/PNG) โดยระบบจะตัดพื้นหลังกระดาษให้เป็น **.PNG พื้นหลังโปร่งใส 100%** อัตโนมัติ
  - หมุนและปรับขนาดสำหรับช่องตารางรายวัน 31 วันในแนวตั้งอย่างสมมาตร
- **ส่งออกรายงานหลายรูปแบบ**:
  - **PDF (A4 แนวนอน)**: ลายเซ็นและข้อความคมชัดสูง ไม่เพี้ยน ไม่เบี้ยว สีถูกต้อง
  - **Word DOCX (A4 แนวนอน)**: ตารางและลายเซ็นขนาดสมมาตรตรงตามเอกสารต้นฉบับ กฟผ.

---

## 🛠️ วิธีติดตั้งและรันในเครื่อง (Local Development)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. รันโหมด Development
npm run dev

# 3. ทดสอบ Build สำหรับ Production
npm run build
```

---

## 🌐 การนำขึ้น GitHub และ Deploy บน Vercel

โปรเจกต์นี้ได้รับการปรับแต่งให้พร้อมสำหรับ **Vercel** และ **GitHub** ทันที 100%:

### 1. นำโค้ดขึ้น GitHub
```bash
git init
git add .
git commit -m "Initial commit: Equipment Inspection Report Generator"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

### 2. Deploy บน Vercel
1. เข้าไปที่ [Vercel Dashboard](https://vercel.com/) แล้วกด **Add New... > Project**
2. เลือก Import repository จาก GitHub ของคุณ
3. ในหน้าตั้งค่าโปรเจกต์ Vercel จะตรวจพบการตั้งค่าอัตโนมัติจากไฟล์ `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. กดปุ่ม **Deploy** แล้วรอประมาณ 30 วินาที ก็จะได้ลิงก์เว็บไซต์ใช้งานจริงทันที!

> **ข้อดี**: ไฟล์ `vercel.json` ได้ตั้งค่า SPA Rewrite ไว้เรียบร้อยแล้ว ทำให้กด Refresh หรือสลับหน้าไม่มีปัญหา Error 404 แน่นอนครับ
