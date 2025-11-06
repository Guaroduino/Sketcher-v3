// Ambient module declarations to satisfy TypeScript for CDN/virtual/test imports used in the app.

declare module 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js' {
  export function initializeApp(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js' {
  export type User = any;
  export function onAuthStateChanged(...args: any[]): any;
  export function getAuth(...args: any[]): any;
  export const GoogleAuthProvider: any;
  export function signInWithPopup(...args: any[]): any;
  export function signOut(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js' {
  export function collection(...args: any[]): any;
  export function query(...args: any[]): any;
  export function orderBy(...args: any[]): any;
  export function onSnapshot(...args: any[]): any;
  export function addDoc(...args: any[]): any;
  export function doc(...args: any[]): any;
  export function deleteDoc(...args: any[]): any;
  export function getFirestore(...args: any[]): any;
  export function updateDoc(...args: any[]): any;
  export const serverTimestamp: any;
  export function getDocs(...args: any[]): any;
  export function where(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js' {
  export function ref(...args: any[]): any;
  export function uploadBytes(...args: any[]): any;
  export function getDownloadURL(...args: any[]): any;
  export function getStorage(...args: any[]): any;
  export function deleteObject(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module 'virtual:pwa-register' {
  export function registerSW(...args: any[]): any;
  const _default: any;
  export default _default;
}

// Testing / dev-time libs (provide minimal shapes to suppress tsc module not found errors)
declare module '@testing-library/react' {
  export const render: any;
  export const screen: any;
  export const fireEvent: any;
  const _default: any;
  export default _default;
}

declare module '@testing-library/user-event' {
  const userEvent: any;
  export default userEvent;
}

declare module 'vitest' {
  export const test: any;
  export const expect: any;
  export const vi: any;
}

// Allow any other unknown imports to be safely treated as 'any' (catch-all for small libs used via CDN)
declare module '*://*';
