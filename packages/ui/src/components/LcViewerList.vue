<script setup lang="ts">
/**
 * Lista de espectadores com ações. Componente "burro": só emite intenções;
 * quem decide o que fazer é o serviço do host.
 * `displayName` é texto do viewer → sempre interpolado (escapado), nunca v-html.
 */
export interface ViewerItem {
  id: string;
  displayName: string;
  status: 'pending' | 'admitted';
  /** 'relay' = P2P falhou e o vídeo vai pelo túnel (mais atraso). */
  route?: 'p2p' | 'relay';
}

defineProps<{ viewers: readonly ViewerItem[] }>();
defineEmits<{ admit: [id: string]; reject: [id: string]; kick: [id: string] }>();
</script>

<template>
  <ul v-if="viewers.length" class="lc-viewers">
    <li v-for="v in viewers" :key="v.id" class="lc-viewers__item" :class="{ 'is-pending': v.status === 'pending' }">
      <span class="lc-viewers__avatar" aria-hidden="true">{{ v.displayName.slice(0, 1).toUpperCase() }}</span>
      <span class="lc-viewers__name">
        {{ v.displayName }}
        <small v-if="v.status === 'pending'">quer entrar</small>
        <small v-else-if="v.route === 'relay'" class="lc-viewers__relay" title="A conexão direta falhou; o vídeo chega pelo túnel, com alguns segundos de atraso">via túnel</small>
      </span>
      <span class="lc-viewers__actions">
        <template v-if="v.status === 'pending'">
          <button type="button" class="lc-viewers__btn lc-viewers__btn--ok" @click="$emit('admit', v.id)">Aceitar</button>
          <button type="button" class="lc-viewers__btn" @click="$emit('reject', v.id)">Recusar</button>
        </template>
        <button v-else type="button" class="lc-viewers__btn" @click="$emit('kick', v.id)">Remover</button>
      </span>
    </li>
  </ul>
  <p v-else class="lc-viewers__empty">Ninguém assistindo ainda. Envie o link para alguém.</p>
</template>

<style scoped>
.lc-viewers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--lc-space-2);
}
.lc-viewers__item {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'avatar name' 'actions actions';
  align-items: center;
  gap: var(--lc-space-2) var(--lc-space-3);
  padding: var(--lc-space-3);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-surface-2);
}
@media (min-width: 480px) {
  .lc-viewers__item {
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'avatar name actions';
  }
}
.lc-viewers__item.is-pending {
  outline: 1px solid var(--lc-accent);
}
.lc-viewers__avatar {
  grid-area: avatar;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--lc-border);
  font-weight: 700;
}
.lc-viewers__name {
  grid-area: name;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lc-text);
}
.lc-viewers__name small {
  display: block;
  color: var(--lc-accent);
}
.lc-viewers__name small.lc-viewers__relay {
  color: var(--lc-accent-2);
}
.lc-viewers__actions {
  grid-area: actions;
  display: flex;
  gap: var(--lc-space-2);
  justify-content: flex-end;
}
.lc-viewers__btn {
  min-height: 36px;
  padding: 0 var(--lc-space-3);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-sm);
  background: transparent;
  color: var(--lc-text);
  font: 600 0.85rem var(--lc-font);
  cursor: pointer;
}
.lc-viewers__btn--ok {
  background: var(--lc-accent);
  border-color: var(--lc-accent);
  color: var(--lc-accent-text);
}
.lc-viewers__empty {
  margin: 0;
  color: var(--lc-text-muted);
}
</style>
