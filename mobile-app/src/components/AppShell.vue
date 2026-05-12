<script setup lang="ts">
defineProps<{
  title: string
  showProfileShortcut?: boolean
}>()
</script>

<template>
  <div class="app-shell">
    <div class="device-stage">
      <div class="phone-frame">
        <section class="phone-screen">
          <header class="screen-header">
            <h1>{{ title }}</h1>
            <RouterLink
              v-if="showProfileShortcut"
              class="profile-shortcut"
              to="/profile"
              aria-label="個人資料"
            >
              <span class="profile-avatar"></span>
            </RouterLink>
          </header>

          <main class="screen-content">
            <slot />
          </main>

          <nav class="bottom-nav" aria-label="主導航">
            <RouterLink class="nav-link" to="/" exact-active-class="is-active">
              <span class="nav-icon">O</span>
              <span>儀表板</span>
            </RouterLink>
            <RouterLink class="nav-link" to="/trends" exact-active-class="is-active">
              <span class="nav-icon">/</span>
              <span>趨勢報表</span>
            </RouterLink>
            <RouterLink class="nav-link" to="/alerts" exact-active-class="is-active">
              <span class="nav-icon">!</span>
              <span>預警紀錄</span>
            </RouterLink>
            <RouterLink class="nav-link" to="/settings" exact-active-class="is-active">
              <span class="nav-icon">=</span>
              <span>設定</span>
            </RouterLink>
          </nav>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  padding: 28px 18px;
}

.device-stage {
  display: grid;
  place-items: center;
}

.phone-frame {
  width: min(100%, var(--app-device-width));
  border-radius: 34px;
  padding: 10px;
  background: linear-gradient(180deg, #fefefe 0%, #cad6e8 100%);
  box-shadow:
    0 26px 70px rgba(18, 42, 78, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.phone-screen {
  min-height: calc(100dvh - 56px);
  height: min(calc(100dvh - 56px), 915px);
  border-radius: 26px;
  background:
    radial-gradient(circle at top right, rgba(131, 183, 255, 0.22), transparent 30%),
    linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
  overflow: hidden;
  position: relative;
}

.screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: calc(20px + env(safe-area-inset-top, 0px)) 20px 14px;
}

.screen-header h1 {
  margin: 0;
  color: #14304d;
  font-size: 2rem;
  line-height: 1.1;
  letter-spacing: 0.02em;
}

.profile-shortcut {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12px 30px rgba(29, 65, 110, 0.12);
}

.profile-avatar {
  width: 22px;
  height: 22px;
  display: block;
  position: relative;
}

.profile-avatar::before,
.profile-avatar::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: #2d66b0;
}

.profile-avatar::before {
  top: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.profile-avatar::after {
  bottom: 0;
  width: 18px;
  height: 10px;
  border-radius: 10px 10px 6px 6px;
}

.screen-content {
  height: calc(100% - 88px);
  overflow-y: auto;
  padding: 0 20px calc(110px + env(safe-area-inset-bottom, 0px));
  scrollbar-width: none;
}

.screen-content::-webkit-scrollbar {
  display: none;
}

.bottom-nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 12px 10px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(20, 48, 77, 0.08);
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
}

.nav-link {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 8px 4px;
  border-radius: 18px;
  color: #6f8298;
  text-decoration: none;
  font-size: 0.72rem;
  font-weight: 700;
}

.nav-link.is-active {
  color: #174f96;
}

.nav-link.is-active .nav-icon {
  background: #174f96;
  color: #fff;
  box-shadow: 0 10px 18px rgba(23, 79, 150, 0.2);
}

.nav-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  background: rgba(23, 79, 150, 0.08);
  color: #174f96;
  font-size: 0.85rem;
  line-height: 1;
}

@media (max-width: 480px) {
  .app-shell {
    padding: 0;
  }

  .phone-frame {
    width: 100%;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .phone-screen {
    min-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
  }
}
</style>
