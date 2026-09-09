/**
 * Route template — every navigation re-mounts this wrapper, so the fade-up
 * plays once per route change (the "cinematic fade-through" motion cue).
 * Reduced-motion users get content immediately.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up motion-reduce:animate-none">{children}</div>;
}
