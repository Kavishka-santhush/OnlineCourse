<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { Search, ShoppingCart, Sun, Moon, Menu, X, LayoutDashboard, GraduationCap, Shield, LogOut, User, Heart } from 'lucide-vue-next';
import { Button, Input, Avatar, Badge, DropdownMenu, DropdownMenuItem } from '@/components/ui';
import NotificationBell from './NotificationBell.vue';
import { useAuthStore } from '@/stores/auth.js';
import { useCartStore } from '@/stores/cart.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const cart = useCartStore();
const ui = useUiStore();
const router = useRouter();

const q = ref('');
const mobileOpen = ref(false);

function submitSearch() {
  router.push({ name: 'catalog', query: q.value ? { q: q.value } : {} });
  mobileOpen.value = false;
}

// Where a signed-in user lands in the dashboard, by rank.
function homeTarget() {
  if (auth.isModerator) return { name: 'admin-dashboard' };
  if (auth.isInstructor) return { name: 'instructor-dashboard' };
  return { name: 'student-dashboard' };
}

async function signOut() {
  await auth.signOut();
  router.push({ name: 'home' });
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
      <!-- logo -->
      <RouterLink to="/" class="flex shrink-0 items-center gap-2 font-bold">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap class="h-5 w-5" />
        </span>
        <span class="hidden text-lg sm:inline">CourseMarket</span>
      </RouterLink>

      <!-- search -->
      <form class="hidden flex-1 max-w-xl md:block" @submit.prevent="submitSearch">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="q" placeholder="Search for courses, topics, instructors…" class="pl-9" />
        </div>
      </form>

      <!-- desktop nav -->
      <nav class="ml-auto hidden items-center gap-1 md:flex">
        <RouterLink to="/courses" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground">Explore</RouterLink>
        <RouterLink to="/pricing" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground">Pricing</RouterLink>
        <RouterLink to="/blog" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground">Blog</RouterLink>

        <button class="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground" @click="ui.toggleTheme()" :title="`Switch to ${ui.theme === 'dark' ? 'light' : 'dark'} mode`">
          <Moon v-if="ui.theme === 'light'" class="h-5 w-5" />
          <Sun v-else class="h-5 w-5" />
        </button>

        <RouterLink v-if="auth.isAuthed" to="/app/wishlist" class="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground" title="Wishlist">
          <Heart class="h-5 w-5" />
        </RouterLink>

        <RouterLink to="/cart" class="relative rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground" title="Cart">
          <ShoppingCart class="h-5 w-5" />
          <span v-if="cart.count" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{{ cart.count }}</span>
        </RouterLink>

        <NotificationBell v-if="auth.isAuthed" />

        <template v-if="auth.isAuthed">
          <DropdownMenu align="right">
            <template #trigger>
              <button class="ml-1 flex items-center gap-2 rounded-full p-0.5 transition hover:bg-accent">
                <Avatar :src="auth.avatarUrl" :name="auth.displayName" size="sm" />
              </button>
            </template>
            <div class="w-56">
              <div class="px-2.5 py-2">
                <p class="truncate text-sm font-semibold">{{ auth.displayName }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ auth.profile?.email }}</p>
                <Badge class="mt-1.5" variant="muted">{{ auth.role }}</Badge>
              </div>
              <DropdownMenuItem :to="homeTarget()"><LayoutDashboard class="h-4 w-4" /> Dashboard</DropdownMenuItem>
              <DropdownMenuItem :to="{ name: 'my-learning' }"><GraduationCap class="h-4 w-4" /> My Learning</DropdownMenuItem>
              <DropdownMenuItem :to="{ name: 'settings' }"><User class="h-4 w-4" /> Settings</DropdownMenuItem>
              <DropdownMenuItem v-if="auth.isModerator" :to="{ name: 'admin-dashboard' }"><Shield class="h-4 w-4" /> Admin Console</DropdownMenuItem>
              <DropdownMenuItem danger @click="signOut"><LogOut class="h-4 w-4" /> Sign out</DropdownMenuItem>
            </div>
          </DropdownMenu>
        </template>
        <template v-else>
          <Button variant="ghost" size="sm" @click="auth.signIn()">Sign in</Button>
          <Button size="sm" @click="auth.signUp()">Get started</Button>
        </template>
      </nav>

      <!-- mobile toggle -->
      <button class="ml-auto rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden" @click="mobileOpen = !mobileOpen">
        <X v-if="mobileOpen" class="h-6 w-6" />
        <Menu v-else class="h-6 w-6" />
      </button>
    </div>

    <!-- mobile menu -->
    <div v-if="mobileOpen" class="border-t bg-background px-4 py-3 md:hidden">
      <form class="mb-3" @submit.prevent="submitSearch">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="q" placeholder="Search courses…" class="pl-9" />
        </div>
      </form>
      <nav class="flex flex-col gap-1">
        <RouterLink to="/courses" class="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" @click="mobileOpen = false">Explore</RouterLink>
        <RouterLink to="/pricing" class="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" @click="mobileOpen = false">Pricing</RouterLink>
        <RouterLink to="/blog" class="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" @click="mobileOpen = false">Blog</RouterLink>
        <RouterLink to="/cart" class="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" @click="mobileOpen = false">Cart ({{ cart.count }})</RouterLink>
        <button class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" @click="ui.toggleTheme()">
          <Moon v-if="ui.theme === 'light'" class="h-4 w-4" /><Sun v-else class="h-4 w-4" /> Theme
        </button>
        <div class="my-2 h-px bg-border" />
        <template v-if="auth.isAuthed">
          <RouterLink :to="homeTarget()" class="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" @click="mobileOpen = false">Dashboard</RouterLink>
          <Button variant="outline" class="mt-1 w-full" @click="signOut">Sign out</Button>
        </template>
        <template v-else>
          <div class="flex gap-2">
            <Button variant="outline" class="flex-1" @click="auth.signIn()">Sign in</Button>
            <Button class="flex-1" @click="auth.signUp()">Get started</Button>
          </div>
        </template>
      </nav>
    </div>
  </header>
</template>
