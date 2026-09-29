import { ref, shallowRef, onBeforeUnmount } from 'vue';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.js';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');

/**
 * Live-classroom socket. Chat, hand-raise, presence and WebRTC signalling
 * for a single class room. The server expects `{ userId, role }` in the
 * handshake auth payload.
 */
export function useLiveClass() {
  const auth = useAuthStore();
  const socket = shallowRef(null);
  const connected = ref(false);
  const messages = ref([]);        // [{ userId, text, at }]
  const hands = ref([]);           // userIds with a raised hand
  const participants = ref([]);    // userIds currently in the room
  const sharing = ref(null);       // userId currently screen-sharing
  const incomingSignal = ref(null); // { from, data } for WebRTC
  let lastClassId = null;

  function connect(classId) {
    disconnect();
    lastClassId = classId;
    if (!auth.profile?.id) return;
    const s = io(API_ORIGIN, {
      auth: { userId: auth.profile.id, role: auth.role },
      transports: ['websocket', 'polling'],
    });
    socket.value = s;
    s.on('connect', () => { connected.value = true; s.emit('class:join', { classId }); });
    s.on('disconnect', () => { connected.value = false; });
    s.on('class:message', (m) => messages.value.push(m));
    s.on('class:hand-raise', ({ userId, raised }) => {
      hands.value = raised
        ? [...new Set([...hands.value, userId])]
        : hands.value.filter((u) => u !== userId);
    });
    s.on('class:participant-joined', ({ userId }) => { if (!participants.value.includes(userId)) participants.value.push(userId); });
    s.on('class:participant-left', ({ userId }) => { participants.value = participants.value.filter((u) => u !== userId); });
    s.on('class:screen-share', ({ userId, sharing: on }) => { sharing.value = on ? userId : null; });
    s.on('class:signal', (payload) => { incomingSignal.value = payload; });
  }

  function send(text) { socket.value?.emit('class:message', { classId: lastClassId, text }); }
  function raiseHand(raised) { socket.value?.emit('class:hand-raise', { classId: lastClassId, raised }); }
  function toggleScreen(sharingOn) { socket.value?.emit('class:screen-share', { classId: lastClassId, sharing: sharingOn }); }
  function signal(to, data) { socket.value?.emit('class:signal', { to, data }); }

  function disconnect() {
    if (socket.value) { socket.value.emit('class:leave'); socket.value.disconnect(); socket.value = null; }
    connected.value = false;
  }

  onBeforeUnmount(disconnect);

  return { socket, connected, messages, hands, participants, sharing, incomingSignal, connect, send, raiseHand, toggleScreen, signal, disconnect };
}
