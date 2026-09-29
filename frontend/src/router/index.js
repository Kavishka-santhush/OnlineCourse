import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

// ── Layouts ────────────────────────────────────────────────────────────
const PublicLayout = () => import('@/layouts/PublicLayout.vue');
const DashboardLayout = () => import('@/layouts/DashboardLayout.vue');

// ── Public views ─────────────────────────────────────────────────────────
const Home = () => import('@/views/public/Home.vue');
const Catalog = () => import('@/views/public/Catalog.vue');
const CourseDetail = () => import('@/views/public/CourseDetail.vue');
const InstructorProfile = () => import('@/views/public/InstructorProfile.vue');
const Pricing = () => import('@/views/public/Pricing.vue');
const Blog = () => import('@/views/public/Blog.vue');
const BlogPost = () => import('@/views/public/BlogPost.vue');
const StaticPage = () => import('@/views/public/StaticPage.vue');
const SignIn = () => import('@/views/public/SignIn.vue');
const VerifyCertificate = () => import('@/views/public/VerifyCertificate.vue');
const Cart = () => import('@/views/public/Cart.vue');
const Checkout = () => import('@/views/public/Checkout.vue');
const NotFound = () => import('@/views/NotFound.vue');

// ── Student views ────────────────────────────────────────────────────────
const StudentDashboard = () => import('@/views/student/StudentDashboard.vue');
const MyLearning = () => import('@/views/student/MyLearning.vue');
const CoursePlayer = () => import('@/views/student/CoursePlayer.vue');
const Wishlist = () => import('@/views/student/Wishlist.vue');
const Certificates = () => import('@/views/student/Certificates.vue');
const Orders = () => import('@/views/student/Orders.vue');
const MyAssignments = () => import('@/views/student/MyAssignments.vue');
const QuizAttempt = () => import('@/views/student/QuizAttempt.vue');
const NotificationsView = () => import('@/views/student/NotificationsView.vue');
const SubscriptionsView = () => import('@/views/student/SubscriptionsView.vue');
const SettingsView = () => import('@/views/student/SettingsView.vue');

// ── Instructor views ───────────────────────────────────────────────────────
const ApplyInstructor = () => import('@/views/instructor/ApplyInstructor.vue');
const InstructorDashboard = () => import('@/views/instructor/InstructorDashboard.vue');
const InstructorCourses = () => import('@/views/instructor/InstructorCourses.vue');
const CourseEditor = () => import('@/views/instructor/CourseEditor.vue');
const CurriculumBuilder = () => import('@/views/instructor/CurriculumBuilder.vue');
const QuizBuilder = () => import('@/views/instructor/QuizBuilder.vue');
const AssignmentManager = () => import('@/views/instructor/AssignmentManager.vue');
const GradingQueue = () => import('@/views/instructor/GradingQueue.vue');
const Earnings = () => import('@/views/instructor/Earnings.vue');
const LiveClasses = () => import('@/views/instructor/LiveClasses.vue');
const Analytics = () => import('@/views/instructor/Analytics.vue');
const MessagesView = () => import('@/views/shared/MessagesView.vue');

// ── Admin views ────────────────────────────────────────────────────────────
const AdminDashboard = () => import('@/views/admin/AdminDashboard.vue');
const AdminUsers = () => import('@/views/admin/AdminUsers.vue');
const AdminModeration = () => import('@/views/admin/AdminModeration.vue');
const AdminInstructors = () => import('@/views/admin/AdminInstructors.vue');
const AdminCommerce = () => import('@/views/admin/AdminCommerce.vue');
const AdminContent = () => import('@/views/admin/AdminContent.vue');
const AdminAnnouncements = () => import('@/views/admin/AdminAnnouncements.vue');
const AdminSettings = () => import('@/views/admin/AdminSettings.vue');

const routes = [
  {
    path: '/', component: PublicLayout,
    children: [
      { path: '', name: 'home', component: Home },
      { path: 'courses', name: 'catalog', component: Catalog },
      { path: 'search', name: 'search', component: Catalog },
      { path: 'category/:slug', name: 'category', component: Catalog, props: true },
      { path: 'courses/:slug', name: 'course-detail', component: CourseDetail, props: true },
      { path: 'instructors/:id', name: 'instructor-profile', component: InstructorProfile, props: true },
      { path: 'pricing', name: 'pricing', component: Pricing },
      { path: 'blog', name: 'blog', component: Blog },
      { path: 'blog/:slug', name: 'blog-post', component: BlogPost, props: true },
      { path: 'p/:slug', name: 'page', component: StaticPage, props: true },
      { path: 'certificates/verify/:id', name: 'verify-certificate', component: VerifyCertificate, props: true },
      { path: 'cart', name: 'cart', component: Cart },
      { path: 'checkout', name: 'checkout', component: Checkout, meta: { requiresAuth: true } },
    ],
  },
  { path: '/signin', name: 'sign-in', component: SignIn },
  { path: '/learn/:slug', name: 'player', component: CoursePlayer, props: true, meta: { requiresAuth: true } },
  {
    path: '/app', component: DashboardLayout, meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'student-dashboard' } },
      // student
      { path: 'dashboard', name: 'student-dashboard', component: StudentDashboard },
      { path: 'learning', name: 'my-learning', component: MyLearning },
      { path: 'wishlist', name: 'wishlist', component: Wishlist },
      { path: 'certificates', name: 'certificates', component: Certificates },
      { path: 'orders', name: 'orders', component: Orders },
      { path: 'assignments', name: 'my-assignments', component: MyAssignments },
      { path: 'quiz/:id', name: 'quiz-attempt', component: QuizAttempt, props: true },
      { path: 'notifications', name: 'notifications', component: NotificationsView },
      { path: 'subscriptions', name: 'subscriptions', component: SubscriptionsView },
      { path: 'messages', name: 'messages', component: MessagesView, meta: { role: 'instructor' } },
      { path: 'settings', name: 'settings', component: SettingsView },
      { path: 'apply-instructor', name: 'apply-instructor', component: ApplyInstructor },
      // instructor
      { path: 'instructor', name: 'instructor-dashboard', component: InstructorDashboard, meta: { role: 'instructor' } },
      { path: 'instructor/courses', name: 'instructor-courses', component: InstructorCourses, meta: { role: 'instructor' } },
      { path: 'instructor/courses/new', name: 'course-new', component: CourseEditor, meta: { role: 'instructor' } },
      { path: 'instructor/courses/:id/edit', name: 'course-edit', component: CourseEditor, props: true, meta: { role: 'instructor' } },
      { path: 'instructor/courses/:id/curriculum', name: 'curriculum', component: CurriculumBuilder, props: true, meta: { role: 'instructor' } },
      { path: 'instructor/quizzes/:id?', name: 'quiz-builder', component: QuizBuilder, props: true, meta: { role: 'instructor' } },
      { path: 'instructor/assignments', name: 'assignment-manager', component: AssignmentManager, meta: { role: 'instructor' } },
      { path: 'instructor/grading', name: 'grading', component: GradingQueue, meta: { role: 'instructor' } },
      { path: 'instructor/earnings', name: 'earnings', component: Earnings, meta: { role: 'instructor' } },
      { path: 'instructor/live-classes', name: 'live-classes', component: LiveClasses, meta: { role: 'instructor' } },
      { path: 'instructor/analytics', name: 'instructor-analytics', component: Analytics, meta: { role: 'instructor' } },
      // admin / moderator
      { path: 'admin', name: 'admin-dashboard', component: AdminDashboard, meta: { role: 'moderator' } },
      { path: 'admin/users', name: 'admin-users', component: AdminUsers, meta: { role: 'admin' } },
      { path: 'admin/moderation', name: 'admin-moderation', component: AdminModeration, meta: { role: 'moderator' } },
      { path: 'admin/instructors', name: 'admin-instructors', component: AdminInstructors, meta: { role: 'admin' } },
      { path: 'admin/commerce', name: 'admin-commerce', component: AdminCommerce, meta: { role: 'admin' } },
      { path: 'admin/content', name: 'admin-content', component: AdminContent, meta: { role: 'admin' } },
      { path: 'admin/announcements', name: 'admin-announcements', component: AdminAnnouncements, meta: { role: 'admin' } },
      { path: 'admin/settings', name: 'admin-settings', component: AdminSettings, meta: { role: 'admin' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.boot();

  const needsAuth = to.matched.some((r) => r.meta?.requiresAuth);
  const needRole = to.matched.map((r) => r.meta?.role).filter(Boolean).pop();

  if (needsAuth && !auth.isAuthed) {
    return { name: 'sign-in', query: { redirect: to.fullPath } };
  }
  if (needRole && !auth.hasRole(needRole)) {
    return { name: auth.isInstructor ? 'instructor-dashboard' : 'student-dashboard' };
  }
  return true;
});
