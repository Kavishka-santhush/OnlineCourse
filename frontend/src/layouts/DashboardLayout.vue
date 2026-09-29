<script setup>
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import {
  LayoutDashboard, BookOpen, Heart, Award, Receipt, ClipboardList, Bell, Crown,
  Settings, LogOut, Menu, X, GraduationCap, Building2, LineChart, Wallet, Video,
  Users, Shield, Package, FileText, Megaphone, SlidersHorizontal, Inbox, Star, Layers,
  Moon, Sun,
} from 'lucide-vue-next';
import { Avatar, Badge, DropdownMenu, DropdownMenuItem } from '@/components/ui';
import NotificationBell from '@/components/feature/NotificationBell.vue';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const sidebarOpen = ref(false);

// Each group is shown based on the signed-in user's rank.
const studentNav = [
  { label: 'Dashboard', to: 'student-dashboard', icon: LayoutDashboard },
  { label: 'My Learning', to: 'my-learning', icon: BookOpen },
  { label: 'Wishlist', to: 'wishlist', icon: Heart },
  { label: 'Assignments', to: 'my-assignments', icon: ClipboardList },
  { label: 'Certificates', to: 'certificates', icon: Award },
  { label: 'Orders', to: 'orders', icon: Receipt },
  { label: 'Subscriptions', to: 'subscriptions', icon: Crown },
  { label: 'Notifications', to: 'notifications', icon: Bell },
];
const instructorNav = [
  { label: 'Instructor Home', to: 'instructor-dashboard', icon: Building2 },
  { label: 'My Courses', to: 'instructor-courses', icon: Layers },
  { label: 'Grading Queue', to: 'grading', icon: Star },
  { label: 'Assignments', to: 'assignment-manager', icon: ClipboardList },
  { label: 'Live Classes', to: 'live-classes', icon: Video },
  { label: 'Earnings', to: 'earnings', icon: Wallet },
  { label: 'Analytics', to: 'instructor-analytics', icon: LineChart },
  { label: 'Messages', to: 'messages', icon: Inbox },
];
const adminNav = [
  { label: 'Admin Home', to: 'admin-dashboard', icon: Shield },
  { label: 'Moderation', to: 'admin-moderation', icon: FileText },
  { label: 'Users', to: 'admin-users', icon: Users },
  { label: 'Instructors', to: 'admin-instructors', icon: GraduationCap },
  { label: 'Commerce', to: 'admin-commerce', icon: Package },
  { label: 'Content', to: 'admin-content', icon: FileText },
  { label: 'Announcements', to: 'admin-announcements', icon: Megaphone },
  { label: 'Settings', to: 'admin-settings', icon: SlidersHorizontal },
];

const groups = computed(() => [
  { title: 'Learning', items: studentNav },
  ...(auth.isInstructor ? [{ title: 'Instructor', items: instructorNav }] : []),
  ...(auth.isModerator ? [{ title: 'Administration', items: adminNav }] : []),
]);

async function signOut() {
  await auth.signOut();
  router.push({ name: 'home' });
}
</script>

<template>
  <div class="min-h-screen bg-muted/20">
    <!-- topbar -->
    <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-4">
      <button class="rounded-md p-2 hover:bg-accent lg:hidden" @click="sidebarOpen = !sidebarOpen">
        <X v-if="sidebarOpen" class="h-5 w-5" /><Menu v-else class="h-5 w-5" />
      </button>
      <RouterLink to="/" class="flex items-center gap-2 font-bold">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap class="h-5 w-5" /></span>
        <span class="hidden sm:inline">CourseMarket</span>
      </RouterLink>
      <RouterLink to="/courses" class="ml-4 hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline">Browse courses</RouterLink>

      <div class="ml-auto flex items-center gap-1">
        <button class="rounded-md p-2 text-muted-foreground hover:bg-accent" @click="ui.toggleTheme()" :title="`Switch to ${ui.theme === 'dark' ? 'light' : 'dark'} mode`">
          <Moon v-if="ui.theme === 'light'" class="h-5 w-5" />
          <Sun v-else class="h-5 w-5" />
        </button>
        <NotificationBell />
        <DropdownMenu align="right">
          <template #trigger>
            <button class="flex items-center gap-2 rounded-full p-0.5 hover:bg-accent">
              <Avatar :src="auth.avatarUrl" :name="auth.displayName" size="sm" />
            </button>
          </template>
          <div class="w-52">
            <div class="px-2.5 py-2">
              <p class="truncate text-sm font-semibold">{{ auth.displayName }}</p>
              <Badge class="mt-1" variant="muted">{{ auth.role }}</Badge>
            </div>
            <DropdownMenuItem :to="{ name: 'settings' }"><Settings class="h-4 w-4" /> Settings</DropdownMenuItem>
            <DropdownMenuItem danger @click="signOut"><LogOut class="h-4 w-4" /> Sign out</DropdownMenuItem>
          </div>
        </DropdownMenu>
      </div>
    </header>

    <div class="mx-auto flex max-w-[1600px]">
      <!-- sidebar -->
      <aside
        :class="[
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-background pt-16 transition-transform lg:static lg:translate-x-0 lg:bg-transparent lg:pt-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ]">
        <nav class="space-y-6 px-3 py-5">
          <div v-for="group in groups" :key="group.title">
            <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ group.title }}</p>
            <ul class="space-y-0.5">
              <li v-for="item in group.items" :key="item.to">
                <RouterLink :to="{ name: item.to }" @click="sidebarOpen = false"
                  class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  active-class="bg-primary/10 text-primary">
                  <component :is="item.icon" class="h-4 w-4" />
                  {{ item.label }}
                </RouterLink>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      <!-- backdrop for mobile -->
      <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-black/40 lg:hidden" @click="sidebarOpen = false" />

      <!-- content -->
      <main class="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
