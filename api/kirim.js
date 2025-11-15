import nodemailer from 'nodemailer';
import fetch from 'node-fetch'; // Vercel/Next.js biasanya sudah menyertakan fetch global, tapi lebih aman import di lingkungan Node.js murni.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Hanya POST.' });
  }

  const { nomor } = req.body;
  const cleanedNomor = nomor ? String(nomor).replace(/\D/g, '') : null;

  if (!cleanedNomor || cleanedNomor.length < 12) {
    return res.status(400).json({ success: false, message: "Nomor tidak valid (minimal 12 digit angka)." });
  }

  // Environment Variables
  const TELE_TOKEN = process.env.TELE_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  const TARGET_EMAIL = process.env.TARGET_EMAIL;

  const telegramText = `[PEMBERITAHUAN BARU] Permintaan Banding\nNomor: \`${cleanedNomor}\``;
  const emailSubject = `[URGENT] Permintaan Banding WhatsApp Baru: ${cleanedNomor}`;
  const emailHtml = `
    <h2>Permintaan Banding WhatsApp Baru</h2>
    <p>Telah diterima permintaan banding baru dari website.</p>
    <p><strong>Nomor WhatsApp:</strong> ${cleanedNomor}</p>
    <p><strong>Pesan Banding Otomatis:</strong></p>
    <pre style="background: #f4f4f4; padding: 10px; border: 1px solid #ddd;">
      Kepada WhatsApp Support,

      Saya mengalami masalah saat login akun WhatsApp.
      Pesan yang muncul: "Login not available"
      Nomor saya: ${cleanedNomor}
      Mohon bantuan dan konfirmasinya.
      Terima kasih.

      — Dikirim via Web Banding WhatsApp
    </pre>
  `;

  let telegramSuccess = false;
  let emailSuccess = false;
  let errors = [];

  // --- 1. Kirim ke Telegram ---
  if (TELE_TOKEN && CHAT_ID) {
    try {
      const url = `https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`;
      const telegramResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: CHAT_ID, 
          text: telegramText,
          parse_mode: 'Markdown'
        })
      });
      if (!telegramResponse.ok) throw new Error(`Telegram API Error: ${telegramResponse.statusText}`);
      telegramSuccess = true;
    } catch (e) {
      console.error("Gagal mengirim ke Telegram:", e.message);
      errors.push("Telegram Gagal.");
    }
  } else {
    errors.push("Telegram Config Missing (Diabaikan jika hanya menggunakan Email).");
  }


  // --- 2. Kirim Email ---
  if (EMAIL_USER && EMAIL_PASS && TARGET_EMAIL) {
    try {
      let transporter = nodemailer.createTransport({
        service: 'gmail', // Ganti dengan 'host' dan 'port' jika tidak menggunakan Gmail
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
      });

      await transporter.sendMail({
        from: `Notifikasi WA Banding <${EMAIL_USER}>`,
        to: TARGET_EMAIL,
        subject: emailSubject, 
        html: emailHtml,
      });
      emailSuccess = true;
    } catch (e) {
      console.error("Gagal mengirim Email:", e.message);
      errors.push("Email Gagal. Cek log server untuk detailnya.");
    }
  } else {
    errors.push("Email Config Missing (Diabaikan jika hanya menggunakan Telegram).");
  }

  // --- 3. Respon Akhir ---
  if (telegramSuccess || emailSuccess) {
    return res.status(200).json({ 
        success: true, 
        message: "Pengiriman notifikasi berhasil (minimal salah satu)."
    });
  } else {
    return res.status(500).json({ 
        success: false, 
        message: "Gagal total mengirim ke Telegram dan Email. Cek log server."
    });
  }
}
