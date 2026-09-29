import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import { db, must, byId, insertOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { renderCertificatePdf } from '../services/pdf.service.js';
import { uploadBuffer, createSignedUrl } from '../lib/storage.js';
import { notify } from '../services/notify.service.js';
import { env } from '../config/env.js';

/**
 * Issue a certificate if one does not already exist for this enrollment.
 * Safe to call repeatedly. Called from progress recalculation.
 */
export async function maybeIssueCertificate({ userId, courseId }) {
  const existing = must(await db.from('certificates').select('*').eq('user_id', userId).eq('course_id', courseId).limit(1));
  if (existing.length) return existing[0];

  const [user, course] = [await byId('users', userId), await byId('courses', courseId)];
  const instructor = await byId('users', course.instructor_id);
  const certificateId = uuid();
  const issuedAt = dayjs().format('MMMM D, YYYY');

  const pdf = await renderCertificatePdf({
    studentName: user.display_name,
    courseTitle: course.title,
    instructorName: instructor?.display_name,
    issuedAt,
    certificateId,
    logoUrl: null,
    template: { ...(course.certificate_template || {}), platform_name: 'CourseMarket' },
  });
  const file = await uploadBuffer(env.storage.certs, `certificates/${userId}`, 'certificate.pdf', pdf, 'application/pdf');

  const certificate = await insertOne('certificates', {
    certificate_id: certificateId,
    user_id: userId,
    course_id: courseId,
    student_name: user.display_name,
    course_title: course.title,
    instructor_name: instructor?.display_name,
    issued_at: issuedAt,
    pdf_path: file.path,
    pdf_url: file.url,
    verify_url: `${env.frontendUrl}/verify/${certificateId}`,
  });

  await notify({
    userId, type: 'certificate',
    title: 'Certificate issued 🎓',
    body: `You earned your certificate for ${course.title}.`,
    link: '/dashboard/certificates',
    email: user.email, emailTemplate: 'certificate', emailData: { name: user.display_name, courseTitle: course.title },
  });
  return certificate;
}

/** GET /api/certificates/me */
export const myCertificates = asyncHandler(async (req, res) => {
  const rows = must(await db.from('certificates').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }));
  res.json({ certificates: rows });
});

/** GET /api/certificates/:id/download — returns a fresh signed URL */
export const downloadCertificate = asyncHandler(async (req, res) => {
  const cert = must(await db.from('certificates').select('*').eq('certificate_id', req.params.id).limit(1))[0];
  if (!cert) throw HttpError.notFound('Certificate not found');
  if (cert.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) throw HttpError.forbidden();
  const url = await createSignedUrl(env.storage.certs, cert.pdf_path, 3600);
  res.json({ url });
});

/** GET /api/certificates/verify/:id — PUBLIC verification */
export const verifyCertificate = asyncHandler(async (req, res) => {
  const cert = must(await db.from('certificates').select('certificate_id,student_name,course_title,instructor_name,issued_at,verify_url,created_at').eq('certificate_id', req.params.id).limit(1))[0];
  if (!cert) return res.json({ valid: false });
  res.json({ valid: true, certificate: cert });
});

/** GET /api/certificates/course/:courseId — instructor bulk view */
export const courseCertificates = asyncHandler(async (req, res) => {
  const course = await byId('courses', req.params.courseId);
  if (!course) throw HttpError.notFound('Course not found');
  if (course.instructor_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) throw HttpError.forbidden();
  const rows = must(await db.from('certificates').select('*').eq('course_id', course.id).order('created_at', { ascending: false }));
  res.json({ certificates: rows });
});
