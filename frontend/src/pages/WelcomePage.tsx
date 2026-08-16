import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Users,
  Shield,
  GraduationCap,
  CreditCard,
  FileBadge,
  LayoutDashboard,
  Globe2,
  Menu,
  X,
  Cloud,
  BarChart3,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolvePublicTenantSubdomain } from '@/lib/institution';
import TenantHomePage from '@/pages/public/TenantHomePage';

/** Update these URLs when TvetFlow social accounts are ready. */
const SOCIAL = [
  { name: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { name: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { name: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  { name: 'X (Twitter)', href: 'https://x.com', icon: Twitter },
  { name: 'YouTube', href: 'https://youtube.com', icon: Youtube },
];

const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

const FEATURES = [
  {
    icon: Building2,
    title: 'Institution portal',
    body: 'Your own branded space with logo, colors, and subdomain-ready links.',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin dashboard',
    body: 'Run classes, staff, enrollments, and daily operations from one place.',
  },
  {
    icon: GraduationCap,
    title: 'Classes & learning',
    body: 'Create programs, manage schedules, and track student progress.',
  },
  {
    icon: Users,
    title: 'Roles that fit',
    body: 'Staff, instructors, affiliates, and students — invited from your institution.',
  },
  {
    icon: CreditCard,
    title: 'Payments',
    body: 'Registration fees, tuition tracking, and clear payment records.',
  },
  {
    icon: FileBadge,
    title: 'Credentials',
    body: 'Issue certificates and transcripts with your institution branding.',
  },
  {
    icon: Shield,
    title: 'Secure isolation',
    body: 'Every institution’s data stays private — built multi-tenant from day one.',
  },
  {
    icon: Globe2,
    title: 'Ready to grow',
    body: 'Start on localhost today; move to your domain and subdomains when ready.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Create admin',
    body: 'Open an institution admin account on TvetFlow.',
  },
  {
    step: '02',
    title: 'Set up institution',
    body: 'Add your center name, contact details, and slug.',
  },
  {
    step: '03',
    title: 'Open your portal',
    body: 'Sign in and start managing your training operations.',
  },
];

const HERO_POINTS = [
  { icon: Shield, label: 'Secure & Reliable' },
  { icon: Users, label: 'Multi-Tenant' },
  { icon: BarChart3, label: 'Powerful Analytics' },
  { icon: Cloud, label: 'Cloud Based' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
};

/**
 * Platform landing (TvetFlow), or tenant branded front-door when a tenant is resolved.
 */
const WelcomePage = () => {
  const [searchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const tenant =
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (tenant) {
    return <TenantHomePage subdomain={tenant} />;
  }

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#061512] text-[#e8f2ef] font-sans">
      <Helmet>
        <title>TvetFlow — Multi-tenant training platform</title>
      </Helmet>

      <header
        className={`sticky top-0 z-30 border-b transition-all duration-500 ${
          scrolled
            ? 'border-white/10 bg-[#061512]/95 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl'
            : 'border-white/5 bg-[#061512]/70 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/" className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              Tvet<span className="text-teal-300">Flow</span>
            </Link>
          </motion.div>

          <motion.nav
            className="hidden items-center gap-0.5 md:flex"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {NAV.map((item, i) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="rounded-md px-3 py-2 text-sm text-[#b7d4cc] transition hover:bg-white/5 hover:text-white"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.04 }}
              >
                {item.label}
              </motion.button>
            ))}
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                asChild
                size="sm"
                className="ml-3 h-9 rounded-md bg-teal-500 px-4 font-semibold text-[#04201c] hover:bg-teal-400"
              >
                <Link to="/login">Sign in</Link>
              </Button>
            </motion.div>
          </motion.nav>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#c5ddd6] transition hover:bg-white/5 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-white/5 bg-[#061512] px-5 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className="rounded-md px-3 py-2.5 text-left text-sm text-[#c5ddd6] hover:bg-white/5"
                >
                  {item.label}
                </button>
              ))}
              <Button asChild className="mt-2 bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400">
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  Sign in
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </header>

      <main className="relative z-10">
        {/* Split hero: copy left, image right */}
        <section id="home" className="relative overflow-hidden border-b border-white/5">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(45,140,120,0.22),transparent_50%),radial-gradient(ellipse_at_90%_10%,rgba(212,163,115,0.08),transparent_40%),linear-gradient(180deg,#061512,#071816)]" />
            <motion.div
              className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl"
              animate={{ x: [0, 30, 0], opacity: [0.35, 0.55, 0.35] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -right-10 bottom-10 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl"
              animate={{ y: [0, -24, 0], opacity: [0.25, 0.45, 0.25] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
            {/* Left: text + buttons */}
            <motion.div
              className="order-2 lg:order-1"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <motion.div
                variants={fadeUp}
                custom={0}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                All-in-One Platform
              </motion.div>

              <motion.p
                variants={fadeUp}
                custom={1}
                className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl"
              >
                Tvet<span className="text-teal-300">Flow</span>
              </motion.p>

              <motion.h1
                variants={fadeUp}
                custom={2}
                className="mt-4 max-w-lg font-display text-xl font-semibold leading-snug text-[#d7ebe4] sm:text-2xl"
              >
                The complete{' '}
                <span className="text-teal-300">training center</span> management platform
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={3}
                className="mt-4 max-w-md text-sm leading-relaxed text-[#9bc4b8] sm:text-base"
              >
                Manage students, courses, attendance, payments, exams, and certificates — in one secure platform built for institutions.
              </motion.p>

              <motion.div
                variants={fadeUp}
                custom={4}
                className="mt-6 grid max-w-md grid-cols-2 gap-3"
              >
                {HERO_POINTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      className="flex items-center gap-2 text-xs text-[#b7d4cc] sm:text-sm"
                      whileHover={{ x: 3 }}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-500/15 text-teal-300">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {item.label}
                    </motion.div>
                  );
                })}
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={5}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    asChild
                    size="lg"
                    className="h-11 rounded-md bg-teal-500 px-6 text-sm font-semibold text-[#04201c] shadow-lg shadow-teal-900/30 hover:bg-teal-400 sm:h-12 sm:text-base"
                  >
                    <Link to="/create-institution">
                      Create institution admin
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="h-11 border-white/15 bg-white/5 text-[#e8f2ef] hover:bg-white/10 sm:h-12"
                    onClick={() => scrollTo('features')}
                  >
                    Explore features
                  </Button>
                </motion.div>
              </motion.div>

              <motion.p variants={fadeUp} custom={6} className="mt-3 text-xs text-[#6f968c] sm:text-sm">
                For institution admins only.
              </motion.p>
            </motion.div>

            {/* Right: hero image */}
            <motion.div
              className="relative order-1 lg:order-2"
              initial={{ opacity: 0, x: 48, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.85, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="absolute -inset-4 rounded-[2rem] bg-teal-400/10 blur-2xl"
                animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.03, 1] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/40"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                whileHover={{ scale: 1.015 }}
              >
                <img
                  src="/tvetflow-hero-devices.png"
                  alt="TvetFlow platform on laptop and mobile"
                  className="h-auto w-full object-cover object-center"
                />
              </motion.div>

              <motion.div
                className="absolute -bottom-3 left-4 hidden rounded-xl border border-white/15 bg-[#0a2420]/95 px-3 py-2 text-xs text-[#c5ddd6] shadow-lg backdrop-blur sm:block"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
              >
                <span className="font-semibold text-teal-300">Secure</span> · Multi-tenant isolation
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-white/5 bg-[#071816] px-5 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-teal-400/90">Features</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                Everything your institution needs
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#8fb5aa] sm:text-base">
                Built for training centers — clear tools, secure tenancy, and a calm admin experience.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.article
                    key={item.title}
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.45, delay: (i % 4) * 0.06 }}
                    whileHover={{ y: -6, transition: { duration: 0.25 } }}
                    className="group rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 transition duration-300 hover:border-teal-500/40 hover:shadow-[0_12px_40px_rgba(20,120,100,0.12)]"
                  >
                    <motion.div
                      className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/20"
                      whileHover={{ rotate: -6, scale: 1.08 }}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <h3 className="font-display text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#7fa89e]">{item.body}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-white/5 bg-[#061512] px-5 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-teal-400/90">How it works</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                Three simple steps
              </h2>
            </motion.div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((item, i) => (
                <motion.article
                  key={item.step}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a2420]/70 p-6"
                >
                  <motion.span
                    className="font-display text-4xl font-bold text-teal-500/25"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  >
                    {item.step}
                  </motion.span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#7fa89e]">{item.body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="border-t border-white/5 bg-[#071816] px-5 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55 }}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-teal-400/90">About</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                Built for institutions, not crowded roles
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#8fb5aa] sm:text-base">
                TvetFlow is a multi-tenant platform for training centers. Institution admins start on this landing page.
                Staff, instructors, affiliates, and students join later from your own institution page — not from here.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-transparent p-6"
            >
              <h3 className="font-display text-lg font-semibold text-white">Who signs up here?</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#9bc4b8]">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                  Institution admin — create account & institution
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5f857c]" />
                  Staff / instructor / student — join from your institution page
                </li>
              </ul>
            </motion.div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="border-t border-white/5 px-5 py-14 sm:px-8 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55 }}
            className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,140,120,0.25),transparent_50%),linear-gradient(135deg,#0a2420,#061512)] p-8 sm:p-10"
          >
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              Ready to open your institution?
            </h2>
            <p className="mt-3 max-w-lg text-sm text-[#8fb5aa] sm:text-base">
              Start with your admin account. You can set up the institution right after.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  size="lg"
                  className="h-11 bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400"
                >
                  <Link to="/create-institution">
                    Create institution admin
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 border-white/15 bg-transparent text-[#e8f2ef] hover:bg-white/5"
                >
                  <Link to="/login">Sign in</Link>
                </Button>
              </motion.div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#6f968c]">Follow us</span>
              <div className="flex flex-wrap gap-2">
                {SOCIAL.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.a
                      key={item.name}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.name}
                      title={item.name}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#b7d4cc] transition hover:border-teal-400/40 hover:bg-teal-500/15 hover:text-teal-200"
                      whileHover={{ y: -2, scale: 1.06 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-base font-bold text-white">
              Tvet<span className="text-teal-300">Flow</span>
            </p>
            <p className="mt-1 text-xs text-[#5f857c]">Multi-tenant training platform</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SOCIAL.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                    title={item.name}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[#7fa89e] transition hover:border-teal-400/35 hover:bg-teal-500/10 hover:text-teal-200"
                    whileHover={{ y: -2, scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.a>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[#5f857c]">
            <button type="button" onClick={() => scrollTo('features')} className="hover:text-[#a8cfc4]">
              Features
            </button>
            <button type="button" onClick={() => scrollTo('about')} className="hover:text-[#a8cfc4]">
              About
            </button>
            <Link to="/privacy" className="hover:text-[#a8cfc4]">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#a8cfc4]">
              Terms
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl text-center text-xs text-[#4d6f67] sm:text-left">
          © {new Date().getFullYear()} TvetFlow
        </p>
      </footer>
    </div>
  );
};

export default WelcomePage;
