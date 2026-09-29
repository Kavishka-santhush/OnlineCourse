import { Router } from 'express';
import { requireAuth, optionalAuth, requireAtLeast, requireAdmin, requireSuperAdmin, requireModerator } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpError.js';

import * as user from '../controllers/user.controller.js';
import * as course from '../controllers/course.controller.js';
import * as curriculum from '../controllers/curriculum.controller.js';
import * as quiz from '../controllers/quiz.controller.js';
import * as assignment from '../controllers/assignment.controller.js';
import * as enrollment from '../controllers/enrollment.controller.js';
import * as certificate from '../controllers/certificate.controller.js';
import * as review from '../controllers/review.controller.js';
import * as wishlist from '../controllers/wishlist.controller.js';
import * as search from '../controllers/search.controller.js';
import * as ai from '../controllers/ai.controller.js';
import * as instructor from '../controllers/instructor.controller.js';
import * as payment from '../controllers/payment.controller.js';
import * as subscription from '../controllers/subscription.controller.js';
import * as liveClass from '../controllers/liveClass.controller.js';
import * as notification from '../controllers/notification.controller.js';
import * as engagement from '../controllers/engagement.controller.js';
import * as admin from '../controllers/admin.controller.js';
import * as category from '../controllers/category.controller.js';
import * as content from '../controllers/content.controller.js';
import { previewDiscount } from '../services/coupon.service.js';

export const api = Router();

/* ── Health ──────────────────────────────────────────────── */
api.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* ── Categories (public) ─────────────────────────────────── */
api.get('/categories', category.listCategories);

/* ── Search & discovery (public) ─────────────────────────── */
api.get('/search', optionalAuth, search.search);
api.get('/search/suggest', search.suggest);
api.get('/search/trending', search.trending);
api.get('/search/featured', search.featured);

/* ── Courses ─────────────────────────────────────────────── */
api.get('/courses', optionalAuth, course.listCourses);
api.get('/courses/moderation/queue', requireAuth, requireModerator, course.moderationQueue);
api.get('/courses/instructor/mine', requireAuth, course.myCourses);
api.get('/courses/:slug', optionalAuth, course.getCourse);
api.post('/courses', requireAuth, requireAtLeast('instructor'), course.createCourse);
api.patch('/courses/:id', requireAuth, course.updateCourse);
api.delete('/courses/:id', requireAuth, course.deleteCourse);
api.post('/courses/:id/submit', requireAuth, course.submitForReview);
api.post('/courses/:id/publish', requireAuth, course.publishCourse);
api.post('/courses/:id/clone', requireAuth, course.cloneCourse);
api.post('/courses/:id/moderate', requireAuth, requireModerator, course.moderateCourse);
api.patch('/courses/:id/feature', requireAuth, requireAdmin, course.togglePromotion);
api.post('/courses/:id/announce', requireAuth, course.createAnnouncement);
api.post('/courses/:id/notify-new-lessons', requireAuth, curriculum.announceNewLessons);

/* curriculum */
api.get('/courses/:courseId/curriculum', requireAuth, curriculum.getCurriculum);
api.post('/courses/:courseId/sections', requireAuth, curriculum.createSection);
api.post('/courses/:courseId/reorder', requireAuth, curriculum.reorderCurriculum);
api.patch('/sections/:id', requireAuth, curriculum.updateSection);
api.delete('/sections/:id', requireAuth, curriculum.deleteSection);
api.post('/sections/:sectionId/lessons', requireAuth, curriculum.createLesson);
api.patch('/lessons/:id', requireAuth, curriculum.updateLesson);
api.delete('/lessons/:id', requireAuth, curriculum.deleteLesson);

/* reviews */
api.get('/courses/:courseId/reviews', review.courseReviews);
api.get('/courses/:courseId/reviews/ai-summary', review.aiReviewSummary);
api.post('/courses/:courseId/reviews', requireAuth, review.createReview);
api.patch('/reviews/:id', requireAuth, review.updateReview);
api.delete('/reviews/:id', requireAuth, review.deleteReview);
api.post('/reviews/:id/helpful', requireAuth, review.markHelpful);
api.post('/reviews/:id/respond', requireAuth, review.respondReview);
api.post('/reviews/:id/report', requireAuth, review.reportReview);

/* ── Instructor domain ───────────────────────────────────── */
api.get('/instructors/:id/profile', instructor.instructorProfile);
api.post('/instructors/apply', requireAuth, instructor.applyInstructor);
api.get('/instructors/apply/status', requireAuth, instructor.applicationStatus);
api.get('/instructors/me/dashboard', requireAuth, instructor.instructorDashboard);
api.get('/instructors/me/earnings', requireAuth, instructor.earnings);
api.get('/instructors/me/analytics', requireAuth, instructor.instructorAnalytics);
api.get('/instructors/me/payouts', requireAuth, instructor.listPayouts);
api.post('/instructors/me/payout-request', requireAuth, instructor.requestPayout);
api.post('/instructors/me/stripe-connect', requireAuth, instructor.setupStripeConnect);

/* ── Users / profile ─────────────────────────────────────── */
api.get('/users/me', requireAuth, user.getMe);
api.patch('/users/me', requireAuth, user.updateMe);
api.post('/users/me/avatar', requireAuth, user.uploadAvatar);
api.patch('/users/me/settings', requireAuth, user.updateSettings);
api.get('/users/me/activity', requireAuth, user.myActivity);
api.get('/users/:id', user.getProfile);

/* ── Enrollment, progress & learning ─────────────────────── */
api.post('/enrollments/free/:courseId', requireAuth, enrollment.enrollFree);
api.get('/enrollments/me', requireAuth, enrollment.myEnrollments);
api.get('/progress/:courseId', requireAuth, enrollment.getCourseProgress);
api.post('/progress/lesson', requireAuth, enrollment.trackLesson);
api.post('/progress/complete', requireAuth, enrollment.markComplete);
api.post('/progress/study-time', requireAuth, enrollment.trackStudyTime);
api.get('/learning/stats', requireAuth, enrollment.learningStats);

/* ── Quizzes ─────────────────────────────────────────────── */
api.get('/quizzes/:id', optionalAuth, quiz.getQuiz);
api.post('/quizzes', requireAuth, requireAtLeast('instructor'), quiz.createQuiz);
api.patch('/quizzes/:id', requireAuth, quiz.updateQuiz);
api.delete('/quizzes/:id', requireAuth, quiz.deleteQuiz);
api.post('/quizzes/:id/questions', requireAuth, quiz.addQuestion);
api.patch('/questions/:id', requireAuth, quiz.updateQuestion);
api.delete('/questions/:id', requireAuth, quiz.deleteQuestion);
api.post('/quizzes/generate', requireAuth, requireAtLeast('instructor'), quiz.generateQuiz);
api.get('/quizzes/me/attempts', requireAuth, quiz.myAttempts);
api.get('/quizzes/:id/attempts', requireAuth, quiz.quizAttempts);
api.post('/quizzes/:id/attempt/start', requireAuth, quiz.startAttempt);
api.post('/quizzes/:id/attempt/submit', requireAuth, quiz.submitAttempt);
api.post('/attempts/:id/grade', requireAuth, quiz.gradeAttempt);
api.get('/question-bank', requireAuth, quiz.listBank);
api.post('/question-bank/from/:questionId', requireAuth, quiz.saveToBank);

/* ── Assignments ─────────────────────────────────────────── */
api.get('/assignments/me', requireAuth, assignment.myAssignments);
api.get('/assignments/course/:courseId', optionalAuth, assignment.courseAssignments);
api.post('/assignments', requireAuth, requireAtLeast('instructor'), assignment.createAssignment);
api.patch('/assignments/:id', requireAuth, assignment.updateAssignment);
api.delete('/assignments/:id', requireAuth, assignment.deleteAssignment);
api.get('/assignments/:id/submissions', requireAuth, assignment.listSubmissions);
api.post('/assignments/:id/submit', requireAuth, assignment.submitAssignment);
api.post('/submissions/:id/grade', requireAuth, assignment.gradeSubmission);
api.post('/submissions/:id/request-resubmit', requireAuth, assignment.requestResubmit);
api.post('/assignments/feedback-assistant', requireAuth, assignment.aiFeedback);

/* ── Certificates ────────────────────────────────────────── */
api.get('/certificates/me', requireAuth, certificate.myCertificates);
api.get('/certificates/verify/:id', certificate.verifyCertificate); // public
api.get('/certificates/:id/download', requireAuth, certificate.downloadCertificate);
api.get('/certificates/course/:courseId', requireAuth, certificate.courseCertificates);

/* ── Wishlist & collections ──────────────────────────────── */
api.get('/wishlist', requireAuth, wishlist.getWishlist);
api.post('/wishlist/:courseId', requireAuth, wishlist.toggleWishlist);
api.get('/collections', requireAuth, wishlist.listCollections);
api.post('/collections', requireAuth, wishlist.createCollection);
api.get('/collections/:id', optionalAuth, wishlist.getCollection);
api.patch('/collections/:id', requireAuth, wishlist.updateCollection);
api.delete('/collections/:id', requireAuth, wishlist.deleteCollection);
api.post('/collections/:id/courses', requireAuth, wishlist.addToCollection);
api.delete('/collections/:id/courses/:courseId', requireAuth, wishlist.removeFromCollection);

/* ── AI features ─────────────────────────────────────────── */
api.get('/ai/recommendations', requireAuth, ai.recommend);
api.post('/ai/tutor', requireAuth, ai.tutor);
api.post('/ai/summarize', requireAuth, ai.summarize);
api.post('/ai/learning-path', requireAuth, ai.learningPath);
api.post('/ai/description', requireAuth, requireAtLeast('instructor'), ai.generateDescription);
api.post('/ai/caption-audit', requireAuth, ai.captionAudit);
api.post('/recently-viewed/:courseId', requireAuth, ai.trackView);

/* ── Payments & coupons ──────────────────────────────────── */
api.post('/payments/checkout', requireAuth, payment.checkout);
api.get('/payments/orders', requireAuth, payment.myOrders);
api.post('/payments/refund-request', requireAuth, payment.requestRefund);
api.get('/payments/refunds/me', requireAuth, payment.myRefunds);
api.post('/coupons/validate', asyncHandler(async (req, res) => {
  res.json(await previewDiscount({ couponCode: req.body.code, courses: req.body.courses || [], subtotal: Number(req.body.subtotal || 0), userId: req.user?.id }));
}));
api.get('/coupons', requireAuth, admin.listCoupons);
api.post('/coupons', requireAuth, requireAtLeast('instructor'), admin.createCoupon);
api.patch('/coupons/:id/toggle', requireAuth, admin.toggleCoupon);

/* ── Subscriptions ───────────────────────────────────────── */
api.get('/subscriptions/plans', subscription.listPlans);
api.get('/subscriptions/me', requireAuth, subscription.mySubscription);
api.post('/subscriptions/subscribe', requireAuth, subscription.subscribe);
api.post('/subscriptions/cancel', requireAuth, subscription.cancelSubscription);
api.post('/subscriptions/resume', requireAuth, subscription.resumeSubscription);
api.post('/subscriptions/bulk-enroll', requireAuth, subscription.bulkEnroll);

/* ── Live classes ────────────────────────────────────────── */
api.get('/live-classes', optionalAuth, liveClass.listLiveClasses);
api.get('/live-classes/:id', optionalAuth, liveClass.getLiveClass);
api.post('/live-classes', requireAuth, requireAtLeast('instructor'), liveClass.createLiveClass);
api.patch('/live-classes/:id', requireAuth, liveClass.updateLiveClass);
api.delete('/live-classes/:id', requireAuth, liveClass.deleteLiveClass);
api.post('/live-classes/:id/leave', requireAuth, liveClass.leaveLiveClass);
api.post('/live-classes/:id/recording', requireAuth, liveClass.uploadRecording);
api.get('/live-classes/:id/attendance', requireAuth, liveClass.classAttendance);

/* ── Notifications ───────────────────────────────────────── */
api.get('/notifications', requireAuth, notification.list);
api.get('/notifications/preferences', requireAuth, notification.getPreferences);
api.post('/notifications/read-all', requireAuth, notification.markAllRead);
api.post('/notifications/:id/read', requireAuth, notification.markRead);
api.delete('/notifications/:id', requireAuth, notification.remove);

/* ── Q&A, messaging, announcements ───────────────────────── */
api.post('/qa', requireAuth, engagement.createQuestion);
api.get('/qa/course/:courseId', engagement.courseQuestions);
api.get('/qa/instructor', requireAuth, engagement.instructorQuestions);
api.post('/qa/:id/upvote', requireAuth, engagement.upvoteAnswer);
api.post('/qa/:id/accept', requireAuth, engagement.acceptAnswer);
api.get('/messages', requireAuth, engagement.inbox);
api.post('/messages', requireAuth, engagement.sendMessage);
api.get('/messages/thread/:userId', requireAuth, engagement.messageThread);
api.get('/announcements/active', engagement.activeAnnouncements);

/* ── Content: blog, pages, faq, sitemap ──────────────────── */
api.get('/blog', content.listPosts);
api.get('/blog/:slug', optionalAuth, content.getPost);
api.post('/blog', requireAuth, requireAdmin, content.createPost);
api.patch('/blog/:id', requireAuth, requireAdmin, content.updatePost);
api.delete('/blog/:id', requireAuth, requireAdmin, content.deletePost);
api.get('/pages/:slug', content.getPage);
api.get('/faqs', content.listFaqs);
api.get('/sitemap', content.sitemap);

/* ── Media upload (Supabase Storage) ─────────────────────── */
api.post('/media/upload', requireAuth, curriculum.uploadMedia);
api.get('/media/signed-url', requireAuth, curriculum.signedUrl);
api.post('/content/upload-image', requireAuth, requireAdmin, content.uploadImage);

/* ── Admin & Super Admin ─────────────────────────────────── */
api.get('/admin/dashboard', requireAuth, requireModerator, admin.dashboard);
api.get('/admin/users', requireAuth, requireAdmin, user.listUsers);
api.patch('/admin/users/:id/role', requireAuth, requireAdmin, user.changeRole);
api.post('/admin/users/:id/suspend', requireAuth, requireAdmin, user.setSuspension);
api.post('/admin/users/:id/unsuspend', requireAuth, requireAdmin, user.setSuspension);
api.delete('/admin/users/:id', requireAuth, requireSuperAdmin, user.deleteUser);
api.get('/admin/applications', requireAuth, requireAdmin, instructor.listApplications);
api.post('/admin/applications/:id/decide', requireAuth, requireAdmin, instructor.decideApplication);
api.post('/admin/instructors/:id/verify', requireAuth, requireAdmin, instructor.setInstructorVerification);
api.get('/admin/payouts', requireAuth, requireAdmin, instructor.adminListPayouts);
api.post('/admin/payouts/:id/decide', requireAuth, requireAdmin, instructor.decidePayout);
api.get('/admin/flags', requireAuth, requireModerator, admin.listFlags);
api.post('/admin/flags/:id/resolve', requireAuth, requireModerator, admin.resolveFlag);
api.get('/admin/refunds', requireAuth, requireAdmin, admin.listRefunds);
api.post('/admin/refunds/:id/decide', requireAuth, requireAdmin, admin.decideRefund);
api.get('/admin/settings', requireAuth, requireAdmin, admin.getSettings);
api.patch('/admin/settings', requireAuth, requireSuperAdmin, admin.updateSettings);
api.get('/admin/ai-usage', requireAuth, requireAdmin, admin.aiUsage);
api.get('/admin/revenue', requireAuth, requireAdmin, admin.revenueReport);
api.post('/admin/reports/export', requireAuth, requireAdmin, admin.exportReport);
api.get('/admin/promotions', requireAuth, requireAdmin, admin.listPromotions);
api.post('/admin/promotions', requireAuth, requireSuperAdmin, admin.createPromotion);
api.get('/admin/audit-log', requireAuth, requireAdmin, admin.auditLog);
api.get('/admin/platform-announcements', requireAuth, requireAdmin, engagement.listPlatformAnnouncements);
api.post('/admin/platform-announcements', requireAuth, requireSuperAdmin, engagement.createPlatformAnnouncement);
api.delete('/admin/platform-announcements/:id', requireAuth, requireSuperAdmin, engagement.deletePlatformAnnouncement);
api.post('/admin/categories', requireAuth, requireAdmin, category.createCategory);
api.patch('/admin/categories/:id', requireAuth, requireAdmin, category.updateCategory);
api.delete('/admin/categories/:id', requireAuth, requireAdmin, category.deleteCategory);
api.post('/admin/pages', requireAuth, requireAdmin, content.upsertPage);
api.post('/admin/faqs', requireAuth, requireAdmin, content.createFaq);
api.delete('/admin/faqs/:id', requireAuth, requireAdmin, content.deleteFaq);
