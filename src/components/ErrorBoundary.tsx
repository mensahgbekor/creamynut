import { Component } from 'react';
import type { ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="font-display text-3xl">Let’s get you back to the shop</h1><p className="mt-4 text-cocoa-600">Something interrupted this page. Refresh to try again. If you were placing an order, contact us before submitting again.</p><button className="mt-6 rounded-full bg-cocoa-900 px-6 py-3 text-white" onClick={() => window.location.reload()}>Refresh page</button><a className="mt-5 block underline" href="https://wa.me/233202001147">Contact CreamyNut on WhatsApp</a></main>;
    return this.props.children;
  }
}
