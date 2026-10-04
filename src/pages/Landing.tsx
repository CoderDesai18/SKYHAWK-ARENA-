import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, ChevronRight, CircleDot, Crosshair, Eye, FileCheck2, Radar, Shield, ShieldCheck, Sparkles, Target, Users, Zap } from 'lucide-react';
import ThreeWorld from '../components/ThreeWorld';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Badge } from '../components/ui';

const features = [
  { icon: Crosshair, label: 'DUAL COCKPITS', title: 'One arena. Two perspectives.', text: 'Switch between a simulated operator flight deck and an abstract defender awareness console. Same training space, distinct decision loops.' },
  { icon: Sparkles, label: 'ADAPTIVE ENGINE', title: 'Training that responds.', text: 'A procedural mission engine uses baseline skills, recent outcomes, and recurring gaps to tune scenario complexity and response windows.' },
  { icon: Activity, label: 'LIVE PERFORMANCE', title: 'Every decision, understood.', text: 'Eight skill dimensions are scored in context, then translated into clear strengths, skill gaps, and practical next steps.' },
  { icon: FileCheck2, label: 'AFTER-ACTION REVIEW', title: 'Turn a run into progress.', text: 'Replay the event timeline, inspect action-level feedback, compare scores, and keep a verified digital skill passport.' }
];

export default function Landing() {
  const navigate = useNavigate();
  const { signInDemo } = useAuth();
  const { toast } = useToast();
  const [demoBusy, setDemoBusy] = useState(false);
  const enterDemo = async () => {
    setDemoBusy(true);
    try { await signInDemo('TRAINEE'); navigate('/dashboard'); toast('Demo trainee session opened. All activity is simulated.', 'success'); }
    catch (error) { toast(error instanceof Error ? error.message : 'Demo session could not be opened.', 'error'); }
    finally { setDemoBusy(false); }
  };

  return <div className="landing-page">
    <header className="landing-nav">
      <Link to="/" className="brand-lockup landing-brand"><span className="brand-mark"><Radar size={22} /></span><div><span className="brand-name">SKYHAWK <b>ARENA</b></span><small>SIMULATION TRAINING SYSTEM</small></div></Link>
      <nav><a href="#platform">PLATFORM</a><a href="#training">TRAINING LOOP</a><a href="#safety">SAFETY</a></nav>
      <div className="landing-nav-actions"><Link to="/login" className="text-button">SIGN IN</Link><Link to="/register" className="nav-cta">ENTER ARENA <ArrowRight size={14} /></Link></div>
    </header>
    <main>
      <section className="hero-section">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="hero-kicker"><span className="live-dot" /> SMART INDIA HACKATHON 2026 <span className="hero-kicker-line" /> SIH26247</div>
          <h1>Prepare for<br /><span>the unseen.</span></h1>
          <p className="hero-title">AI-ENABLED DRONE &amp; COUNTER-DRONE<br />THREAT SIMULATION TRAINER</p>
          <p className="hero-description">A safe, adaptive training environment for building operator readiness and situational awareness — without real-world control systems or operational weapon workflows.</p>
          <div className="hero-buttons"><Link to="/login" className="btn btn-primary btn-lg">ENTER ARENA <ArrowRight size={17} /></Link><button className="btn btn-secondary btn-lg" onClick={enterDemo} disabled={demoBusy}><Eye size={16} /> {demoBusy ? 'OPENING DEMO…' : 'VIEW DEMO'}</button></div>
          <div className="hero-assurance"><ShieldCheck size={15} /><span>SIMULATION ONLY</span><i /> <span>OFFLINE-READY</span><i /> <span>ADAPTIVE PRACTICE</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-scene"><ThreeWorld mode="showcase" threatCount={3} quality="MEDIUM" seed={69} /></div>
          <div className="hero-scene-scrim" />
          <div className="hero-coordinates">SIM GRID / 04<br />SECTOR A-17</div>
          <div className="hero-scope-label"><span className="scope-pulse" /> TRAINING SPACE 04 <span>DAY / LOW HAZE</span></div>
          <div className="hero-scope"><div className="scope-rings" /><i className="scope-sweep" /><span className="scope-blip blip-a" /><span className="scope-blip blip-b" /><span className="scope-blip blip-c" /><span className="scope-crosshair" /></div>
          <div className="hero-visual-caption"><div><span>SCENARIO</span><b>RIDGE / CONTACT AWARENESS</b></div><div><span>SIM TIME</span><b>00:04:26</b></div><span className="hero-live"><i /> LIVE SIM</span></div>
          <div className="hero-telemetry"><div><span>ALT</span><b>084</b><small>M</small></div><div><span>SPD</span><b>016</b><small>M/S</small></div><div><span>HEADING</span><b>278°</b><small>NW</small></div></div>
        </div>
        <div className="hero-bottom-line"><span>TRAIN. SIMULATE. ANALYZE. IMPROVE.</span><span>01 — 04 <ArrowDown size={14} /></span></div>
      </section>
      <section className="trust-strip"><span>BUILT FOR <b>SMART INDIA HACKATHON 2026</b></span><span>MINISTRY OF DEFENCE · ROBOTICS &amp; DRONES THEME</span><span><CircleDot size={12} /> PROTOTYPE / SIH26247</span></section>
      <section className="landing-intro" id="platform"><div className="section-overline">01 / THE TRAINING GAP</div><div className="intro-content"><h2>Readiness is built<br />before the moment.</h2><div><p>Drone operations demand sharp detection, steady navigation, clear decisions, and a shared understanding of the environment. Practice is most useful when it is measurable, repeatable, and safe.</p><p className="muted-copy">SKYHAWK ARENA turns that need into structured, fictional simulation sessions — adaptive to a trainee, visible to an instructor, and designed for improvement.</p></div></div></section>
      <section className="feature-grid-section" id="training"><div className="section-overline">02 / ONE TRAINING LOOP</div><div className="feature-grid">{features.map(({ icon: Icon, label, title, text }, index) => <article className="feature-card" key={label}><div className="feature-card-top"><span>0{index + 1}</span><Icon size={19} /></div><div className="feature-label">{label}</div><h3>{title}</h3><p>{text}</p><span className="feature-rule" /></article>)}</div></section>
      <section className="dual-cockpit"><div className="cockpit-visual"><div className="cockpit-backdrop" /><div className="cockpit-topline"><span>SIM COCKPIT / 02 MODES</span><span>TRAINING BUILD 0.6.2</span></div><div className="cockpit-scope"><div className="scope-rings" /><div className="scope-sweep" /><span className="scope-blip blip-a" /><span className="scope-blip blip-b" /><span className="scope-crosshair" /><div className="cockpit-readout"><span>SIMULATED CONTACTS</span><b>02 <small>ACTIVE</small></b><i>ALL RESPONSES FICTIONAL</i></div></div><div className="cockpit-footer"><span>OPERATOR VIEW</span><span>DEFENDER VIEW</span><span>REPLAY VIEW</span></div></div><div className="cockpit-copy"><div className="section-overline">03 / DUAL COCKPIT</div><h2>Practice the<br /><span>whole picture.</span></h2><p>Operator mode builds navigation and objective discipline in a low-poly 3D world. Defender mode trains contact awareness through fictional detect, track, classify, and respond stages.</p><div className="cockpit-points"><div><Target size={16} /><span>Operator / waypoint navigation</span></div><div><Radar size={16} /><span>Defender / contact awareness</span></div><div><Shield size={16} /><span>Abstract, simulation-only responses</span></div></div><Link to="/register" className="inline-link">EXPLORE THE ARENA <ArrowRight size={15} /></Link></div></section>
      <section className="training-loop"><div className="section-overline">04 / FROM BASELINE TO BETTER</div><div className="loop-heading"><h2>A closed loop for<br /><span>measurable growth.</span></h2><p>Each session becomes the next useful step. No trained model dependency — a transparent procedural adaptation engine makes the prototype explainable and ready for a future Python / PPO service.</p></div><div className="loop-track"><div className="loop-line" /><div className="loop-step"><span>01</span><b>ASSESS</b><small>Baseline skill profile</small></div><div className="loop-step"><span>02</span><b>GENERATE</b><small>Adaptive mission brief</small></div><div className="loop-step"><span>03</span><b>SIMULATE</b><small>Live actions &amp; scoring</small></div><div className="loop-step"><span>04</span><b>REVIEW</b><small>Replay &amp; skill gaps</small></div><div className="loop-step"><span>05</span><b>IMPROVE</b><small>Next mission + passport</small></div></div></section>
      <section className="safety-section" id="safety"><div className="safety-seal"><ShieldCheck size={28} /><span>SAFE<br />BY DESIGN</span></div><div><div className="section-overline">SIMULATION BOUNDARY</div><h2>Training data. Not operational data.</h2><p>All environments, contacts, actions, and electronic effects are fictional and abstract. The prototype has no real-world weapon targeting, control interfaces, or countermeasure instructions. It is designed solely for training and demonstration.</p></div><Badge tone="green">SIMULATION ONLY</Badge></section>
      <section className="landing-cta"><span className="landing-cta-grid" /><div><div className="section-overline">READY WHEN YOU ARE</div><h2>Enter the arena.</h2><p>Start with a baseline assessment. Leave with a clearer picture of your next skill to build.</p></div><div className="landing-cta-actions"><Link to="/register" className="btn btn-primary btn-lg">CREATE TRAINEE PROFILE <ArrowRight size={16} /></Link><button className="btn btn-secondary" onClick={enterDemo}>OPEN DEMO DASHBOARD</button></div></section>
    </main>
    <footer className="landing-footer"><Link to="/" className="brand-lockup"><span className="brand-mark"><Radar size={19} /></span><div><span className="brand-name">SKYHAWK <b>ARENA</b></span><small>AI SIMULATION TRAINER</small></div></Link><span>SIH 2026 · PROTOTYPE · BUILD 0.6.2</span><span>FICTIONAL TRAINING ENVIRONMENT ONLY <ArrowUpRight size={13} /></span></footer>
  </div>;
}
